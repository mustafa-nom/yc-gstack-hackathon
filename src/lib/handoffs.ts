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
};

export type DesignBrief = {
  nicheSlug: string;
  niche: string;
  personaPath: string;
  topics: string[];
  referenceTiktok?: string;
};

// ---------------------------------------------------------------------------
// GBrain readers
// ---------------------------------------------------------------------------

async function readReferenceAccount(): Promise<string | undefined> {
  const page = await getPage("reference-tiktok-account");
  if (!page) return undefined;
  const { body } = parseFrontmatter(page);
  // Body is "# Reference TikTok Account\n\n<url>\n" — grab the URL line
  const match = body.match(/https?:\/\/[^\s]+/);
  return match?.[0];
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

// ---------------------------------------------------------------------------
// Persona builder — reads product + niche context entirely from GBrain
// ---------------------------------------------------------------------------

export async function buildPersonaForNiche(niche: string): Promise<PersonaYaml> {
  const slug = nicheSlugFromName(niche);

  // Niche-specific context from GBrain
  const nichePage = (await getPage(`niches/${slug}`)) ?? "";
  const hooks = extractHooks(nichePage).slice(0, 6);
  const voice = extractVoice(nichePage);

  // Product context from user state (seeded during onboarding)
  const user = await readUserState();

  const accountHandle = `@${slug.replace(/-/g, "")}`;

  return {
    account: { name: slug, handle: accountHandle },
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
  };
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
  const slug = nicheSlugFromName(input.niche);
  const personaPath = await writePersonaForNiche(input.niche);

  // Topic seeds — use winning hooks from GBrain niche page
  const page = (await getPage(`niches/${slug}`)) ?? "";
  const hooks = extractHooks(page).slice(0, 3);
  const topics = hooks.length
    ? hooks
    : [
        `${input.niche} essentials`,
        `common ${input.niche} mistakes`,
        `${input.niche} quick wins`,
      ];

  // Reference TikTok account — read from GBrain, fall back to user state
  const referenceFromGbrain = await readReferenceAccount();
  const user = await readUserState();
  const referenceTiktok = referenceFromGbrain ?? user?.referenceTiktok;

  return {
    nicheSlug: slug,
    niche: input.niche,
    personaPath,
    topics,
    referenceTiktok,
  };
}

// Suppress unused — parseFrontmatter is re-exported for callers that want it
export { parseFrontmatter };
