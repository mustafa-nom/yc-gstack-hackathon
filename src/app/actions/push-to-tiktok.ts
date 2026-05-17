"use server";

export type PushResult = {
  posted: boolean;
  postUrl?: string;
  message: string;
  mocked: boolean;
};

export async function pushToTiktok(input: {
  nicheSlug: string;
}): Promise<PushResult> {
  if (process.env.RUN_REAL_TIKTOK_PUSH !== "1") {
    return {
      posted: true,
      postUrl: `https://tiktok.com/@brainpost/preview/${input.nicheSlug}`,
      message: `[mock] Posted ${input.nicheSlug} carousel to TikTok. Set RUN_REAL_TIKTOK_PUSH=1 to actually post.`,
      mocked: true,
    };
  }

  // Real implementation lives in the teammate's TikTok push module.
  // When ready, replace the body of this branch with their invocation.
  throw new Error(
    "Real TikTok push not yet wired — teammate's module is the entry point.",
  );
}
