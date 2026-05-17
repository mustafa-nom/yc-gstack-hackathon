"use server";

const POSTIZ_BASE = "https://api.postiz.com";

function postizHeaders(contentType?: string): Record<string, string> {
  const key = process.env.POSTIZ_API_KEY;
  if (!key) throw new Error("POSTIZ_API_KEY is not set");
  const h: Record<string, string> = { Authorization: key };
  if (contentType) h["Content-Type"] = contentType;
  return h;
}

export type PushResult = {
  posted: boolean;
  postUrl?: string;
  message: string;
  mocked: boolean;
};

async function listIntegrations(): Promise<{ id: string; profile: string; identifier: string }[]> {
  const res = await fetch(`${POSTIZ_BASE}/public/v1/integrations`, {
    headers: postizHeaders(),
  });
  if (!res.ok) throw new Error(`Postiz GET /integrations ${res.status}: ${await res.text()}`);
  return res.json();
}

async function integrationIdForTiktok(handle: string): Promise<string | null> {
  const integrations = await listIntegrations();
  for (const i of integrations) {
    if (i.identifier === "tiktok" && i.profile?.toLowerCase() === handle.toLowerCase()) {
      return i.id;
    }
  }
  // Fall back to first TikTok integration if handle not matched
  const fallback = integrations.find((i) => i.identifier === "tiktok");
  return fallback?.id ?? null;
}

async function schedulePost(
  integrationId: string,
  caption: string,
  publishAt: Date,
  media: { id: string; path: string }[],
): Promise<{ id: string }> {
  const body = {
    type: "schedule",
    date: publishAt.toISOString(),
    shortLink: false,
    tags: [],
    posts: [
      {
        integration: { id: integrationId },
        value: [{ content: caption, image: media }],
        settings: {
          privacy_level: "PUBLIC_TO_EVERYONE",
          duet: true,
          stitch: true,
          comment: true,
          autoAddMusic: "no",
          brand_content_toggle: false,
          brand_organic_toggle: false,
          content_posting_method: "UPLOAD",
        },
      },
    ],
  };
  const res = await fetch(`${POSTIZ_BASE}/public/v1/posts`, {
    method: "POST",
    headers: postizHeaders("application/json"),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Postiz POST /posts ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function pushToTiktok(input: {
  nicheSlug: string;
  caption?: string;
  tiktokHandle?: string;
  scheduledFor?: string; // ISO string; defaults to 10 minutes from now
}): Promise<PushResult> {
  if (process.env.RUN_REAL_TIKTOK_PUSH !== "1") {
    return {
      posted: true,
      postUrl: `https://tiktok.com/@brainpost/preview/${input.nicheSlug}`,
      message: `[mock] Posted ${input.nicheSlug} carousel to TikTok. Set RUN_REAL_TIKTOK_PUSH=1 to actually post.`,
      mocked: true,
    };
  }

  const handle = input.tiktokHandle ?? "brainpost";
  const integrationId = await integrationIdForTiktok(handle);
  if (!integrationId) {
    throw new Error(`No Postiz TikTok integration found for handle "${handle}". Check postiz.com integrations.`);
  }

  const publishAt = input.scheduledFor
    ? new Date(input.scheduledFor)
    : new Date(Date.now() + 10 * 60 * 1000);

  const caption = input.caption ?? `${input.nicheSlug.replace(/-/g, " ")} #brainpost #tiktok`;

  const result = await schedulePost(integrationId, caption, publishAt, []);

  return {
    posted: true,
    postUrl: `https://postiz.com/posts/${result.id}`,
    message: `Scheduled to TikTok via Postiz at ${publishAt.toLocaleTimeString()}`,
    mocked: false,
  };
}

export async function getPostizIntegrations() {
  return listIntegrations();
}
