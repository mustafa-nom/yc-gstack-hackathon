import type { Strategy, HookEntry, CreatorEntry } from "./schema";
import { putPageDetached, upsertWithBody } from "../gbrain";
import {
  slugify,
  nicheSlugFromName,
  archetypeSlug,
  creatorSlugFromHandle,
} from "../slugs";

export { slugify, nicheSlugFromName, creatorSlugFromHandle } from "../slugs";

export function archetypeSlugFromHook(hook: HookEntry): string {
  return archetypeSlug(hook.archetype);
}

function renderNicheCompiledTruth(s: Strategy): string {
  const out: string[] = [];
  out.push("## Compiled truth", "");
  out.push(s.niche_summary, "");

  out.push("### Winning hooks");
  for (const h of s.hooks) {
    const cred = h.creator_handle ? `[[${creatorSlugFromHandle(h.creator_handle)}]]` : "?";
    const why = h.why_it_works ? ` Why: ${h.why_it_works}` : "";
    out.push(
      `- "${h.text}" — ${cred} (archetype: [[patterns/${archetypeSlugFromHook(h)}]]).${why}`,
    );
  }
  out.push("");

  if (s.formats && s.formats.length) {
    out.push("### Formats");
    for (const f of s.formats) {
      const when = f.when_to_use ? ` Use when: ${f.when_to_use}.` : "";
      out.push(`- **${f.name}**: ${f.structure}.${when}`);
    }
    out.push("");
  }

  out.push("### Hashtags");
  out.push(`Primary: ${s.hashtags.primary_cluster.map((t) => `#${t.replace(/^#/, "")}`).join(" ")}`);
  if (s.hashtags.trending && s.hashtags.trending.length) {
    out.push(`Trending: ${s.hashtags.trending.map((t) => `#${t.replace(/^#/, "")}`).join(" ")}`);
  }
  out.push("");

  if (s.voice) {
    out.push("### Voice");
    const tone = s.voice.tone;
    const pacing = s.voice.pacing ? ` · ${s.voice.pacing}` : "";
    const avoid = s.voice.avoid && s.voice.avoid.length ? ` · avoid: ${s.voice.avoid.join(", ")}` : "";
    out.push(`${tone}${pacing}${avoid}`, "");
  }

  if (s.anti_patterns && s.anti_patterns.length) {
    out.push("### Anti-patterns");
    for (const a of s.anti_patterns) {
      const why = a.why_it_fails ? ` — ${a.why_it_fails}` : "";
      out.push(`- ${a.pattern}${why}`);
    }
    out.push("");
  }

  return out.join("\n");
}

function renderCreatorTruth(c: CreatorEntry, niche: string): string {
  const out: string[] = [];
  out.push("## Compiled truth", "");
  out.push(`Handle: @${c.handle.replace(/^@/, "")}`);
  if (c.style) out.push(`Style: ${c.style}`);
  if (c.posting_cadence) out.push(`Cadence: ${c.posting_cadence}`);
  out.push("", `Active in niche: [[niches/${niche}]]`);
  return out.join("\n");
}

function renderHookTruth(h: HookEntry, niche: string): string {
  const out: string[] = [];
  out.push("## Compiled truth", "");
  out.push(`Verbatim: "${h.text}"`);
  out.push(`Archetype: [[patterns/${archetypeSlugFromHook(h)}]]`);
  out.push(`Creator: [[${creatorSlugFromHandle(h.creator_handle)}]]`);
  out.push(`Niche: [[niches/${niche}]]`);
  if (h.source_url) out.push(`Source: ${h.source_url}`);
  if (h.why_it_works) out.push("", `Why it works: ${h.why_it_works}`);
  return out.join("\n");
}

function renderPatternTruth(archetype: string, examples: HookEntry[]): string {
  const out: string[] = [];
  out.push("## Compiled truth", "");
  out.push(`Archetype: ${archetype}`);
  out.push(`Instance count: ${examples.length}`);
  if (examples[0]?.why_it_works) {
    out.push("", `Why it wins: ${examples[0].why_it_works}`);
  }
  out.push("", "### Example hooks");
  for (const h of examples.slice(0, 6)) {
    out.push(`- "${h.text}" — [[${creatorSlugFromHandle(h.creator_handle)}]]`);
  }
  return out.join("\n");
}

export type TransformWriteResult = {
  nicheSlug: string;
  creatorSlugs: string[];
  patternSlugs: string[];
  hookCount: number;
};

export async function transformAndWrite(
  strategy: Strategy,
  opts: { runId: string; niche: string; opId?: string },
): Promise<TransformWriteResult> {
  const nicheSlug = `niches/${nicheSlugFromName(opts.niche)}`;
  const ts = new Date().toISOString();

  await upsertWithBody(
    nicheSlug,
    {
      type: "niche",
      slug: nicheSlugFromName(opts.niche),
      title: opts.niche,
      tags: ["niche", "hog-ingestion"],
    },
    (existing) => {
      const compiled = renderNicheCompiledTruth(strategy);
      const timeline = ["", "## Timeline"];
      if (existing) {
        const m = existing.match(/## Timeline\n?([\s\S]*)$/);
        if (m && m[1].trim()) timeline.push(m[1].trim());
      }
      timeline.push(
        `- ${ts} run=${opts.runId} op=${opts.opId ?? "n/a"} hooks=${strategy.hooks.length} creators=${strategy.creators.length}`,
      );
      return [compiled, "", ...timeline].join("\n");
    },
  );

  const creatorByHandle = new Map<string, CreatorEntry>();
  for (const c of strategy.creators) {
    creatorByHandle.set(c.handle, c);
  }
  for (const h of strategy.hooks) {
    if (!creatorByHandle.has(h.creator_handle)) {
      creatorByHandle.set(h.creator_handle, { handle: h.creator_handle });
    }
  }

  const creatorSlugs: string[] = [];
  for (const [handle, c] of creatorByHandle) {
    const slug = `creators/${creatorSlugFromHandle(handle)}`;
    creatorSlugs.push(slug);
    putPageDetached(
      slug,
      {
        type: "creator",
        slug: creatorSlugFromHandle(handle),
        title: `@${handle.replace(/^@/, "")}`,
        tags: ["creator", "hog-ingestion"],
      },
      renderCreatorTruth(c, nicheSlugFromName(opts.niche)) +
        `\n\n## Timeline\n- ${ts} run=${opts.runId} appeared in [[${nicheSlug}]]\n`,
    );
  }

  for (let i = 0; i < strategy.hooks.length; i++) {
    const h = strategy.hooks[i];
    const slug = `hooks/${nicheSlugFromName(opts.niche)}-${i + 1}`;
    putPageDetached(
      slug,
      {
        type: "hook",
        slug: `${nicheSlugFromName(opts.niche)}-${i + 1}`,
        title: h.text.slice(0, 60),
        tags: ["hook", "hog-ingestion"],
      },
      renderHookTruth(h, nicheSlugFromName(opts.niche)),
    );
  }

  const patternsByArchetype = new Map<string, HookEntry[]>();
  for (const h of strategy.hooks) {
    const a = archetypeSlugFromHook(h);
    const arr = patternsByArchetype.get(a) ?? [];
    arr.push(h);
    patternsByArchetype.set(a, arr);
  }

  const patternSlugs: string[] = [];
  for (const [archetype, examples] of patternsByArchetype) {
    const slug = `patterns/${archetype}`;
    patternSlugs.push(slug);
    putPageDetached(
      slug,
      {
        type: "pattern",
        slug: archetype,
        title: `Pattern: ${archetype}`,
        tags: ["pattern", "hog-ingestion"],
      },
      renderPatternTruth(archetype, examples) +
        `\n\n## Timeline\n- ${ts} run=${opts.runId} +${examples.length} examples from [[${nicheSlug}]]\n`,
    );
  }

  return {
    nicheSlug,
    creatorSlugs,
    patternSlugs,
    hookCount: strategy.hooks.length,
  };
}
