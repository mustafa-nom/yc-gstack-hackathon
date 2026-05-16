import { dump as yamlDump } from "js-yaml";
import { getPage, parseFrontmatter } from "./gbrain";
import { nicheSlugFromName } from "./hog/transformer";
import { readUserState, brainpostPath } from "./state";
import { promises as fs } from "node:fs";
import path from "node:path";

export type PersonaYaml = {
  account: { name: string; handle: string };
  audience: {
    description: string;
    pain_points: string[];
    seeking: string;
  };
  tone: {
    voice: string;
    title_style: string;
    example_hooks: string[];
  };
  visual_identity: {
    vibe: string;
    aesthetic_keywords: string[];
    color_palette: string[];
    what_not_to_show: string[];
  };
  content: {
    slides_per_carousel: number;
    topics_per_batch: number;
  };
  image_generation: {
    aspect_ratio: string;
    base_prompt: string;
    title_prompt: string;
    scene_variety: string[];
  };
  text_overlay: {
    text_color: string;
    font_size_title: number;
    font_size_subtitle: number;
    font_size_body: number;
    slide_margin: number;
  };
};

export type DesignBrief = {
  nicheSlug: string;
  niche: string;
  personaPath: string;
  topics: string[];
  referenceTiktok?: string;
};

function defaultVisualIdentity(): PersonaYaml["visual_identity"] {
  return {
    vibe: "Clean modern editorial",
    aesthetic_keywords: ["minimal", "high-contrast", "modern", "trustworthy"],
    color_palette: ["#09090b", "#fafafa", "#d4745f"],
    what_not_to_show: ["clipart", "stock photo cliches", "low-contrast text"],
  };
}

function defaultImageGeneration(): PersonaYaml["image_generation"] {
  return {
    aspect_ratio: "9:16",
    base_prompt:
      "Candid iPhone photo, full bleed, no text, no overlay, no border, no watermark",
    title_prompt: "Eye-catching minimal scene matching the niche tone",
    scene_variety: [
      "Tight close-up on a single relevant object in soft moody lighting",
      "Wide environmental shot with depth, neutral tones",
      "Top-down flat-lay arrangement with negative space",
      "Low-angle perspective with one bold visual anchor",
      "Hand-in-frame candid moment showing scale",
    ],
  };
}

function defaultTextOverlay(): PersonaYaml["text_overlay"] {
  return {
    text_color: "#ffffff",
    font_size_title: 86,
    font_size_subtitle: 38,
    font_size_body: 56,
    slide_margin: 44,
  };
}

export async function buildPersonaForNiche(niche: string): Promise<PersonaYaml> {
  const slug = nicheSlugFromName(niche);
  const nichePage = (await getPage(`niches/${slug}`)) ?? "";
  const user = await readUserState();

  const accountName = slug;
  const handle = `@${slug.replace(/-/g, "")}`;

  const hooks = extractHooks(nichePage).slice(0, 6);
  const voice = extractVoice(nichePage);
  const antiPatterns = extractAntiPatterns(nichePage);

  return {
    account: { name: accountName, handle },
    audience: {
      description:
        user?.icp ??
        `People interested in ${niche}. Time-constrained, looking for actionable insights.`,
      pain_points: ["lack of time", "information overload", "not sure what works"],
      seeking: "specific, actionable, no fluff",
    },
    tone: {
      voice: voice || "Direct, specific, no motivational filler",
      title_style: "Direct contrarian hook",
      example_hooks: hooks.length
        ? hooks
        : [
            `Why everyone is wrong about ${niche}`,
            `The ${niche} mistake that costs you time`,
          ],
    },
    visual_identity: {
      ...defaultVisualIdentity(),
      what_not_to_show: [
        ...defaultVisualIdentity().what_not_to_show,
        ...antiPatterns.slice(0, 3),
      ],
    },
    content: { slides_per_carousel: 6, topics_per_batch: 3 },
    image_generation: defaultImageGeneration(),
    text_overlay: defaultTextOverlay(),
  };
}

function extractHooks(page: string): string[] {
  const m = page.match(/### Winning hooks\n([\s\S]*?)(?:\n### |$)/);
  if (!m) return [];
  return Array.from(m[1].matchAll(/"([^"]+)"/g))
    .map((mm) => mm[1])
    .slice(0, 6);
}

function extractVoice(page: string): string | null {
  const m = page.match(/### Voice\n([^\n]+)/);
  return m ? m[1].trim() : null;
}

function extractAntiPatterns(page: string): string[] {
  const m = page.match(/### Anti-patterns\n([\s\S]*?)(?:\n## |$)/);
  if (!m) return [];
  return m[1]
    .split("\n")
    .map((l) => l.replace(/^-\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 5);
}

export async function writePersonaForNiche(niche: string): Promise<string> {
  const persona = await buildPersonaForNiche(niche);
  const slug = nicheSlugFromName(niche);
  const dir = brainpostPath("personas");
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, `persona-${slug}.yaml`);
  await fs.writeFile(filePath, yamlDump(persona, { lineWidth: 120 }), "utf-8");
  return filePath;
}

export async function prepareDesignBrief(input: {
  niche: string;
}): Promise<DesignBrief> {
  const user = await readUserState();
  const slug = nicheSlugFromName(input.niche);
  const personaPath = await writePersonaForNiche(input.niche);

  const page = (await getPage(`niches/${slug}`)) ?? "";
  const hooks = extractHooks(page).slice(0, 3);
  const topics = hooks.length
    ? hooks
    : [`${input.niche} essentials`, `common ${input.niche} mistakes`, `${input.niche} quick wins`];

  return {
    nicheSlug: slug,
    niche: input.niche,
    personaPath,
    topics,
    referenceTiktok: user?.referenceTiktok,
  };
}

// Suppress unused — parseFrontmatter is re-exported for callers that want it
export { parseFrontmatter };
