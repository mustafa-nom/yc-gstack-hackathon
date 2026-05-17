import { generateText, Output } from "ai";
import { StrategySchema, type Strategy, type HogSearchItem } from "@/lib/hog/schema";
import { getAgentModel } from "./model";

export async function synthesizeStrategyFromCaptions(input: {
  niche: string;
  items: HogSearchItem[];
}): Promise<Strategy> {
  const ranked = [...input.items]
    .filter((it) => (it.content ?? "").trim().length > 20)
    .sort((a, b) => (b.plays ?? 0) - (a.plays ?? 0))
    .slice(0, 12);

  const exemplars = ranked
    .map((it, i) => {
      const plays = it.plays ? `${(it.plays / 1000).toFixed(0)}k plays` : "n/a";
      const likes = it.likes ? `${(it.likes / 1000).toFixed(1)}k likes` : "n/a";
      const date = it.published_at?.slice(0, 10) ?? "";
      const content = (it.content ?? "").slice(0, 800);
      return `[V${i + 1} | ${plays} | ${likes} | ${date}]\n${content}`;
    })
    .join("\n\n");

  const { experimental_output: output } = await generateText({
    model: getAgentModel("synthesize"),
    experimental_output: Output.object({ schema: StrategySchema }),
    system:
      "You are a TikTok content analyst. Given real TikTok captions and engagement metrics, you extract a content strategy: verbatim hooks (first line of caption), hashtags (from #tags in caption text), creator archetypes, formats, voice, and anti-patterns. Be specific — quote hooks verbatim and cite which video number (V1, V2, ...) you pulled each from.",
    prompt: [
      `Niche: "${input.niche}"`,
      "",
      "Below are real TikTok video captions with play counts and like counts (highest plays first). Synthesize the content strategy that's working in this niche right now.",
      "",
      "For each hook in your output:",
      "- text: the FIRST line of the caption verbatim, max 120 chars (this is the hook the video opens with)",
      "- archetype: one of contrarian | question | listicle | pov | relatable-mistake | us-vs-them | personal-story",
      "- creator_handle: parse from @mentions in the caption if visible, otherwise use V1/V2/...",
      "- source_url: leave empty if not present",
      "- why_it_works: 1 sentence",
      "",
      "Hashtags: pull every #tag you see in any caption, dedupe, split into primary_cluster (most common) and trending (more niche).",
      "Anti-patterns: identify 2-3 things that DON'T appear in any high-play video but would be obvious filler.",
      "",
      `niche_slug: "${input.niche}"`,
      "",
      "VIDEOS:",
      exemplars,
    ].join("\n"),
  });

  return output as Strategy;
}
