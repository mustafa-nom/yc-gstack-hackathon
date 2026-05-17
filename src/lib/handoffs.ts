import { dump as yamlDump } from "js-yaml";
import { getPage, parseFrontmatter } from "./gbrain";
import { nicheSlugFromName } from "./hog/transformer";
import { readUserState, brainpostPath } from "./state";
import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";
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
  referencePosts?: string[];
  contextLog: string[];
};

// ---------------------------------------------------------------------------
// yt-dlp scraper — get top post URLs from a TikTok account
// ---------------------------------------------------------------------------

const YT_DLP = process.env.YT_DLP_BIN ?? "yt-dlp";

function extractHandle(accountUrl: string): string {
  const m = accountUrl.match(/tiktok\.com\/@([^/?#]+)/);
  return m?.[1] ?? accountUrl.replace(/.*@/, "").replace(/[/?#].*/, "");
}

async function scrapeTopPostUrls(accountUrl: string, top = 7): Promise<string[]> {
  return new Promise((resolve) => {
    const child = spawn(
      YT_DLP,
      ["--flat-playlist", "--no-warnings", "--print", "%(id)s", "--playlist-items", `1:${top * 3}`, accountUrl],
      { env: process.env },
    );
    let stdout = "";
    child.stdout.on("data", (d: Buffer) => (stdout += d.toString()));
    child.on("error", () => resolve([]));
    child.on("close", (code) => {
      if (code !== 0 && !stdout.trim()) { resolve([]); return; }
      const handle = extractHandle(accountUrl);
      const ids = stdout.split("\n").map((l) => l.trim()).filter(Boolean);
      resolve(ids.slice(0, top).map((id) => `https://www.tiktok.com/@${handle}/video/${id}`));
    });
  });
}

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

  // Reference TikTok account + scrape top posts via yt-dlp
  const referenceFromGbrain = await readReferenceAccount();
  const referenceTiktok = referenceFromGbrain ?? user?.referenceTiktok;
  let referencePosts: string[] = [];

  if (referenceTiktok) {
    contextLog.push(`reference account: ${referenceTiktok}`);
    contextLog.push("scraping: fetching top posts via yt-dlp…");
    referencePosts = await scrapeTopPostUrls(referenceTiktok, 7);
    if (referencePosts.length > 0) {
      contextLog.push(`scraped: ${referencePosts.length} posts found`);
    } else {
      contextLog.push("scraped: no posts found — style analysis will use generic prompts");
    }
  } else {
    contextLog.push("reference account: none — using generic prompts");
  }

  const personaPath = await writePersonaForNiche(input.niche);
  contextLog.push(`persona written: ${personaPath.split("/").slice(-1)[0]}`);

  return {
    nicheSlug: slug,
    niche: input.niche,
    personaPath,
    topics,
    referenceTiktok,
    referencePosts,
    contextLog,
  };
}

// Suppress unused — parseFrontmatter is re-exported for callers that want it
export { parseFrontmatter };
