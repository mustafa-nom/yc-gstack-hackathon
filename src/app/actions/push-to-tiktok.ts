"use server";

import { readFile } from "node:fs/promises";
import path from "node:path";

const POSTIZ_BASE = "https://api.postiz.com";

function postizApiKey(): string {
  const key = process.env.POSTIZ_API_KEY;
  if (!key) throw new Error("POSTIZ_API_KEY is not set");
  return key;
}

function postizHeaders(contentType?: string): Record<string, string> {
  const h: Record<string, string> = { Authorization: postizApiKey() };
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
  const fallback = integrations.find((i) => i.identifier === "tiktok");
  return fallback?.id ?? null;
}

// Upload a single image to Postiz. `src` is either:
//   - a public-relative path like /mock-slides/slide_01.jpg (reads from ./public/)
//   - a full http(s) URL (fetched remotely)
async function uploadMedia(src: string): Promise<{ id: string; path: string }> {
  let buffer: Buffer;
  let filename: string;

  if (src.startsWith("http://") || src.startsWith("https://")) {
    const res = await fetch(src);
    if (!res.ok) throw new Error(`Failed to fetch image ${src}: ${res.status}`);
    buffer = Buffer.from(await res.arrayBuffer());
    filename = src.split("/").pop()?.split("?")[0] ?? "slide.jpg";
  } else {
    const abs = path.join(process.cwd(), "public", src.replace(/^\//, ""));
    buffer = await readFile(abs);
    filename = path.basename(abs);
  }

  const formData = new FormData();
  const arrayBuf = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
  formData.append("file", new Blob([arrayBuf], { type: "image/jpeg" }), filename);

  const res = await fetch(`${POSTIZ_BASE}/public/v1/media`, {
    method: "POST",
    headers: { Authorization: postizApiKey() },
    body: formData,
  });
  if (!res.ok) throw new Error(`Postiz media upload ${res.status}: ${await res.text()}`);
  return res.json();
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
          content_posting_method: "DIRECT_POST",
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
  integrationId?: string;
  scheduledFor?: string; // ISO string; defaults to 10 minutes from now
  imageSrcs?: string[]; // public-relative paths or full URLs
}): Promise<PushResult> {
  if (process.env.RUN_REAL_TIKTOK_PUSH !== "1") {
    return {
      posted: true,
      postUrl: `https://tiktok.com/@gpost/preview/${input.nicheSlug}`,
      message: `[mock] Posted ${input.nicheSlug} carousel to TikTok. Set RUN_REAL_TIKTOK_PUSH=1 to actually post.`,
      mocked: true,
    };
  }

  let integrationId = input.integrationId;
  if (!integrationId) {
    const handle = input.tiktokHandle ?? "gpost";
    integrationId = (await integrationIdForTiktok(handle)) ?? undefined;
  }
  if (!integrationId) {
    throw new Error("No Postiz TikTok integration found. Check postiz.com integrations.");
  }

  const publishAt = input.scheduledFor
    ? new Date(input.scheduledFor)
    : new Date(Date.now() + 10 * 60 * 1000);

  const caption = input.caption ?? `${input.nicheSlug.replace(/-/g, " ")} #gpost #tiktok`;

  // Upload images in parallel
  const media: { id: string; path: string }[] = [];
  if (input.imageSrcs && input.imageSrcs.length > 0) {
    const uploaded = await Promise.all(input.imageSrcs.map(uploadMedia));
    media.push(...uploaded);
  }

  const result = await schedulePost(integrationId, caption, publishAt, media);

  return {
    posted: true,
    postUrl: `https://postiz.com/posts/${result.id}`,
    message: `Posted to TikTok via Postiz${media.length ? ` with ${media.length} images` : ""}`,
    mocked: false,
  };
}

export async function getPostizIntegrations() {
  return listIntegrations();
}
