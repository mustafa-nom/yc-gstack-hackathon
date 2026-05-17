"use server";

import { loadPerformanceFixture, type Learning } from "./performance";
import { readJson, writeJson } from "@/lib/state";
import { generateCarouselFromLearnings } from "@/lib/agents/insights";

export async function incorporateFeedback(input: { learningId: string }) {
  const learning = await readJson<Learning>(`learnings/${input.learningId}.json`);
  if (!learning) {
    throw new Error(`learning ${input.learningId} not found`);
  }

  const rows = await loadPerformanceFixture();
  rows.sort((a, b) => b.metrics.actualViews - a.metrics.actualViews);

  const topPerformer = rows[0]?.carousel;
  const niche = topPerformer?.niche ?? rows[0]?.carousel.niche ?? "personal finance";
  const recentHooks = rows.slice(0, 5).map((r) => r.carousel.hook);

  const result = await generateCarouselFromLearnings({
    learnings: learning.patterns,
    niche,
    recentHooks,
  });

  await writeJson(
    `carousels/next-${input.learningId}.json`,
    {
      id: `next-${input.learningId}`,
      ...result,
      createdAt: new Date().toISOString(),
      basedOn: input.learningId,
    },
  );

  return result;
}
