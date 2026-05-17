import { generateText, Output } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { nicheSlugFromName } from "@/lib/slugs";
import type { Strategy } from "@/lib/hog/schema";

const PERSONA_MODEL = process.env.PERSONA_MODEL ?? "claude-sonnet-4-6";

export const PersonaSchema = z.object({
  account: z.object({ name: z.string(), handle: z.string() }),
  audience: z.object({
    description: z.string(),
    pain_points: z.array(z.string()),
    seeking: z.string(),
  }),
  tone: z.object({
    voice: z.string(),
    title_style: z.string(),
    example_hooks: z.array(z.string()),
  }),
  visual_identity: z.object({
    vibe: z.string(),
    aesthetic_keywords: z.array(z.string()),
    scene_elements: z.array(z.string()),
    color_palette: z.array(z.string()),
    what_not_to_show: z.array(z.string()),
  }),
  content: z.object({
    slides_per_carousel: z.number(),
    topics_per_batch: z.number(),
  }),
  image_generation: z.object({
    base_prompt: z.string(),
    aspect_ratio: z.string(),
    title_prompt: z.string(),
    scene_variety: z.array(z.string()),
  }),
  text_overlay: z.object({
    font_size_title: z.number(),
    font_size_body: z.number(),
    font_size_subtitle: z.number(),
    text_color: z.string(),
    text_shadow: z.boolean(),
    overlay_opacity: z.number(),
    slide_margin: z.number(),
    box_padding: z.number(),
  }),
});

export type Persona = z.infer<typeof PersonaSchema>;

export async function buildPersonaForStrategy(input: {
  niche: string;
  strategy: Strategy;
}): Promise<Persona> {
  const { niche, strategy } = input;
  const slug = nicheSlugFromName(niche);
  const handle = `@${slug.replace(/-/g, "")}`;

  const topHooks = strategy.hooks.slice(0, 5).map((h) => h.text);
  const topHashtags = strategy.hashtags.primary_cluster.slice(0, 8);
  const archetypes = Array.from(
    new Set(strategy.hooks.map((h) => h.archetype)),
  ).slice(0, 4);

  const { experimental_output: output } = await generateText({
    model: anthropic(PERSONA_MODEL),
    experimental_output: Output.object({ schema: PersonaSchema }),
    system:
      "You design TikTok carousel personas. Given a niche and synthesized content strategy, you produce a complete persona spec that drives image-generation prompts, text overlay style, and tone for short-form carousel slides. The visual identity must MATCH the niche — fitness niches get gym imagery, B2B SaaS niches get office/laptop imagery, finance niches get desk/charts imagery, food niches get kitchen imagery, etc. Never default to fitness or fashion unless that IS the niche. Be specific in scene descriptions so the image model knows what to render.",
    prompt: [
      `Niche: "${niche}"`,
      "",
      "Niche summary (Claude's analysis of what's working on TikTok in this niche):",
      strategy.niche_summary,
      "",
      `Top hooks from this niche (use as inspiration for tone + example_hooks):`,
      ...topHooks.map((h, i) => `${i + 1}. "${h}"`),
      "",
      `Common hook archetypes: ${archetypes.join(", ")}`,
      `Primary hashtags: ${topHashtags.map((t) => `#${t.replace(/^#/, "")}`).join(" ")}`,
      "",
      `Output a complete persona JSON conforming to the schema. Requirements:`,
      `- account.name: "${niche}" (verbatim)`,
      `- account.handle: "${handle}"`,
      `- audience.description: a 2-3 sentence description of WHO consumes this content`,
      `- audience.pain_points: 3 specific pain points this audience has`,
      `- audience.seeking: 1 sentence on what they want from content`,
      `- tone.voice: 1-2 sentences describing the voice (e.g., "Direct, contrarian, no fluff")`,
      `- tone.title_style: 1 phrase`,
      `- tone.example_hooks: pick 3 of the top hooks above verbatim`,
      `- visual_identity: pick aesthetic/scene/colors that MATCH the niche subject matter (not fitness unless the niche IS fitness)`,
      `- visual_identity.what_not_to_show: 3-4 things that would feel off-brand`,
      `- content.slides_per_carousel: 6`,
      `- content.topics_per_batch: 3`,
      `- image_generation.base_prompt: short prompt that applies to ALL slides (e.g., "Candid iPhone photo, no text, no UI, full bleed, photographic grain, not AI-aesthetic")`,
      `- image_generation.aspect_ratio: "9:16"`,
      `- image_generation.title_prompt: detailed scene description for the title slide that captures the niche subject (50-80 words)`,
      `- image_generation.scene_variety: 5 distinct, detailed scene prompts that feel like b-roll for this niche (each 30-60 words, no people unless niche demands it, varied compositions)`,
      `- text_overlay: use defaults — font_size_title: 52, font_size_body: 36, font_size_subtitle: 38, text_color: "#FFFFFF", text_shadow: true, overlay_opacity: 0.75, slide_margin: 44, box_padding: 28`,
    ].join("\n"),
  });

  return output as Persona;
}
