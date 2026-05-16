"use server";

import { ulid } from "ulid";
import { loadPerformanceFixture, type Learning } from "./performance";
import { extractLearningsFromMetrics } from "@/lib/agents/insights";
import { writeJson } from "@/lib/state";
import { addTimelineEntry } from "@/lib/gbrain";
import { nicheSlugFromName } from "@/lib/hog/transformer";

export async function generateInsights(): Promise<Learning> {
  const rows = await loadPerformanceFixture();
  const carousels = rows.map((r) => r.carousel);
  const metrics = rows.map((r) => r.metrics);

  const { patterns } = await extractLearningsFromMetrics({ carousels, metrics });

  const learning: Learning = {
    id: ulid(),
    generatedAt: new Date().toISOString(),
    patterns,
  };
  await writeJson(`learnings/${learning.id}.json`, learning);

  const niches = Array.from(new Set(carousels.map((c) => c.niche)));
  for (const niche of niches) {
    const slug = `niches/${nicheSlugFromName(niche)}`;
    try {
      await addTimelineEntry(
        slug,
        learning.generatedAt,
        `learnings ${learning.id} from ${carousels.length} carousels: ${patterns
          .map((p) => p.pattern)
          .join(" | ")}`,
      );
    } catch {
      // Niche page may not exist yet (no Hog run for it) — non-fatal
    }
  }

  return learning;
}
