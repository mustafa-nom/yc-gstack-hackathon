import { generateText, Output } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import type { Carousel, Metrics } from "@/app/actions/performance";

const INSIGHTS_MODEL = process.env.INSIGHTS_MODEL ?? "claude-opus-4-7";
const REGEN_MODEL = process.env.REGEN_MODEL ?? "claude-opus-4-7";

const LearningSchema = z.object({
  patterns: z
    .array(
      z.object({
        pattern: z.string().describe("The named pattern, 3-7 words"),
        evidence: z
          .string()
          .describe(
            "Specific numbers and carousel IDs that support this pattern (e.g. 'c03 -43% deltaPct, c04 -24% deltaPct')",
          ),
        recommendation: z
          .string()
          .describe("What to do differently in the next batch"),
      }),
    )
    .min(2)
    .max(4),
});

export async function extractLearningsFromMetrics(input: {
  carousels: Carousel[];
  metrics: Metrics[];
}): Promise<{ patterns: { pattern: string; evidence: string; recommendation: string }[] }> {
  const rows = input.carousels.map((c) => {
    const m = input.metrics.find((mm) => mm.carouselId === c.id);
    return {
      id: c.id,
      niche: c.niche,
      hook: c.hook,
      archetype: c.archetype,
      predicted: m?.predictedViews ?? 0,
      actual: m?.actualViews ?? 0,
      delta: m?.deltaPct ?? 0,
      completionRate: m?.completionRate ?? 0,
      shares: m?.shares ?? 0,
      saves: m?.saves ?? 0,
    };
  });

  const tableLines = rows.map(
    (r) =>
      `${r.id} | ${r.niche} | ${r.archetype} | "${r.hook}" | predicted=${r.predicted} actual=${r.actual} delta=${r.delta}% complete=${(r.completionRate * 100).toFixed(0)}% shares=${r.shares} saves=${r.saves}`,
  );

  const { experimental_output: output } = await generateText({
    model: anthropic(INSIGHTS_MODEL),
    experimental_output: Output.object({ schema: LearningSchema }),
    system:
      "You are a TikTok content analyst. Given a batch of carousels and their performance metrics, you extract specific, actionable patterns separating winners from losers. Cite exact carousel IDs and numbers. Never make generic claims.",
    prompt: [
      "Analyze these 7 carousels and their performance.",
      "Identify 2-4 specific patterns that separate winners from losers.",
      "Be specific: cite carousel IDs, exact delta percentages, and propose concrete recommendations.",
      "",
      "Carousels:",
      ...tableLines,
    ].join("\n"),
  });

  return output as { patterns: { pattern: string; evidence: string; recommendation: string }[] };
}

const NewCarouselSchema = z.object({
  hook: z.string().describe("Verbatim title slide. Must reflect the learnings."),
  archetype: z.string().describe("Archetype label, e.g. 'personal-story', 'us-vs-them'"),
  niche: z.string(),
  slides: z
    .array(
      z.object({
        title: z.string().describe("Slide title, 3-7 words"),
        body: z.string().describe("1-2 sentences, 15-30 words"),
      }),
    )
    .min(5)
    .max(6),
});

export async function generateCarouselFromLearnings(input: {
  learnings: { pattern: string; evidence: string; recommendation: string }[];
  niche: string;
  recentHooks: string[];
}): Promise<z.infer<typeof NewCarouselSchema>> {
  const { experimental_output: output } = await generateText({
    model: anthropic(REGEN_MODEL),
    experimental_output: Output.object({ schema: NewCarouselSchema }),
    system:
      "You are a TikTok carousel writer. Produce a single carousel that explicitly addresses the learnings provided. Avoid hook archetypes that recently underperformed.",
    prompt: [
      `Niche: ${input.niche}`,
      "",
      "Recent learnings (incorporate these):",
      ...input.learnings.map(
        (l, i) => `${i + 1}. ${l.pattern} — ${l.evidence}. Action: ${l.recommendation}`,
      ),
      "",
      "Recent hook texts (do not repeat their archetypes if they underperformed):",
      ...input.recentHooks.map((h) => `- "${h}"`),
      "",
      "Write a 6-slide carousel (1 title slide + 5 content slides) that reflects the learnings.",
    ].join("\n"),
  });

  return output as z.infer<typeof NewCarouselSchema>;
}
