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
  contextLog: string[];
};

// ---------------------------------------------------------------------------
// GBrain readers
// ---------------------------------------------------------------------------

async function readReferenceAccount(): Promise<string | undefined> {
  const page = await getPage("reference-tiktok-account");
  if (!page) return undefined;
  const { body } = parseFrontmatter(page);
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
// Persona builder — reads product + niche context from GBrain
// ---------------------------------------------------------------------------

export async function buildPersonaForNiche(niche: string): Promise<PersonaYaml> {
  const slug = nicheSlugFromName(niche);
  const nichePage = (await getPage(`niches/${slug}`)) ?? "";
  const user = await readUserState();

  const hooks = extractHooks(nichePage).slice(0, 6);
  const voice = extractVoice(nichePage);
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
  const contextLog: string[] = [];

  // Product context
  const user = await readUserState();
  if (user?.website) contextLog.push(`product: ${user.website}`);
  if (user?.description) contextLog.push(`description: ${user.description}`);
  if (user?.icp) contextLog.push(`icp: ${user.icp.slice(0, 120)}${user.icp.length > 120 ? "…" : ""}`);

  // Niche context from GBrain
  const page = (await getPage(`niches/${slug}`)) ?? "";
  const voice = extractVoice(page);
  const allHooks = extractHooks(page);
  const antiPatterns = extractAntiPatterns(page);

  if (voice) contextLog.push(`voice: ${voice}`);
  if (allHooks.length) contextLog.push(`hooks found in gbrain: ${allHooks.length}`);
  if (antiPatterns.length) contextLog.push(`anti-patterns: ${antiPatterns.slice(0, 3).join(" · ")}`);

  // Topic seeds
  const topics = allHooks.length
    ? allHooks.slice(0, 3)
    : [`${input.niche} essentials`, `common ${input.niche} mistakes`, `${input.niche} quick wins`];

  contextLog.push(`topics: ${topics.map((t) => `"${t}"`).join(" · ")}`);

  // Reference TikTok account
  const referenceFromGbrain = await readReferenceAccount();
  const referenceTiktok = referenceFromGbrain ?? user?.referenceTiktok;
  if (referenceTiktok) contextLog.push(`reference account: ${referenceTiktok}`);
  else contextLog.push("reference account: none — using generic prompts");

  const personaPath = await writePersonaForNiche(input.niche);
  contextLog.push(`persona written: ${personaPath.split("/").slice(-1)[0]}`);

  return {
    nicheSlug: slug,
    niche: input.niche,
    personaPath,
    topics,
    referenceTiktok,
    contextLog,
  };
}

// Suppress unused — parseFrontmatter is re-exported for callers that want it
export { parseFrontmatter };
