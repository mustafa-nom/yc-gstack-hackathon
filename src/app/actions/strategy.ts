"use server";

import { promises as fs } from "node:fs";
import path from "node:path";
import { brainpostPath, writeJson } from "@/lib/state";
import type { Strategy } from "@/lib/hog/schema";
import type { StrategyData } from "@/types";
import {
  buildPersonaForStrategy,
  type Persona,
} from "@/lib/agents/persona-builder";

type StoredStrategy = {
  runId: string;
  niche: string;
  nicheSlug: string;
  group: number;
  generatedAt: string;
  strategy: Strategy;
};

export async function loadLatestStrategy(): Promise<StoredStrategy | null> {
  const dir = brainpostPath("strategies");
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return null;
  }
  const jsons = entries.filter((e) => e.endsWith(".json"));
  if (!jsons.length) return null;

  const withStat = await Promise.all(
    jsons.map(async (name) => {
      const full = path.join(dir, name);
      const stat = await fs.stat(full);
      return { name, full, mtime: stat.mtimeMs };
    }),
  );
  withStat.sort((a, b) => b.mtime - a.mtime);

  try {
    const raw = await fs.readFile(withStat[0].full, "utf-8");
    return JSON.parse(raw) as StoredStrategy;
  } catch {
    return null;
  }
}

function archetypeCount(strategy: Strategy): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const h of strategy.hooks) {
    const a = h.archetype || "mixed";
    counts[a] = (counts[a] ?? 0) + 1;
  }
  return counts;
}

function dominantArchetype(strategy: Strategy): string {
  const counts = archetypeCount(strategy);
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[0] ?? "mixed";
}

function nicheFitScore(strategy: Strategy): number {
  const hooks = strategy.hooks.length;
  const creators = strategy.creators.length;
  const hashtags =
    strategy.hashtags.primary_cluster.length +
    (strategy.hashtags.trending?.length ?? 0);
  const raw = hooks * 4 + creators * 3 + hashtags * 1.5;
  return Math.max(0, Math.min(99, Math.round(raw * 10) / 10));
}

export type StrategyView = {
  runId: string;
  nicheSlug: string;
  niche: string;
  nicheSummary: string;
  archetype: string;
  hookCount: number;
  creatorCount: number;
  hashtagCount: number;
  topHook: string;
  topHookWhy: string;
  topCreators: string[];
  primaryHashtags: string[];
  generatedAt: string;
  persona: Persona | null;
  legacy: StrategyData;
};

function archetypeLabel(slug: string): string {
  const m: Record<string, string> = {
    contrarian: "Contrarian takes",
    question: "Open-loop questions",
    listicle: "Listicles",
    pov: "POV / first-person",
    "relatable-mistake": "Relatable mistakes",
    "us-vs-them": "Us vs. them",
    "personal-story": "Personal stories",
    mixed: "Mixed formats",
  };
  return m[slug] ?? slug.replace(/-/g, " ");
}

async function loadPersona(
  runId: string,
  nicheSlug: string,
): Promise<Persona | null> {
  try {
    const raw = await fs.readFile(
      brainpostPath(`personas-generated/${runId}-${nicheSlug}.json`),
      "utf-8",
    );
    const parsed = JSON.parse(raw) as { persona?: Persona };
    return parsed.persona ?? null;
  } catch {
    return null;
  }
}

async function loadOrBuildPersona(
  runId: string,
  nicheSlug: string,
  niche: string,
  strategy: Strategy,
): Promise<Persona | null> {
  const cached = await loadPersona(runId, nicheSlug);
  if (cached) return cached;
  try {
    const persona = await buildPersonaForStrategy({ niche, strategy });
    await writeJson(`personas-generated/${runId}-${nicheSlug}.json`, {
      runId,
      niche,
      nicheSlug,
      generatedAt: new Date().toISOString(),
      persona,
    });
    return persona;
  } catch (err) {
    console.error("[strategy] persona build failed:", err);
    return null;
  }
}

export async function loadLatestStrategyView(): Promise<StrategyView | null> {
  const stored = await loadLatestStrategy();
  if (!stored) return null;
  const { strategy, niche, runId, nicheSlug, generatedAt } = stored;
  const topHook = strategy.hooks[0];
  const archetype = dominantArchetype(strategy);
  const slidesPerCarousel = 6;

  const hashtagCount =
    strategy.hashtags.primary_cluster.length +
    (strategy.hashtags.trending?.length ?? 0);

  const persona = await loadOrBuildPersona(runId, nicheSlug, niche, strategy);

  return {
    runId,
    nicheSlug,
    niche,
    nicheSummary: strategy.niche_summary,
    archetype: archetypeLabel(archetype),
    hookCount: strategy.hooks.length,
    creatorCount: strategy.creators.length,
    hashtagCount,
    topHook: topHook?.text ?? "—",
    topHookWhy: topHook?.why_it_works ?? "",
    topCreators: strategy.creators.slice(0, 4).map((c) => c.handle),
    primaryHashtags: strategy.hashtags.primary_cluster.slice(0, 6),
    generatedAt,
    persona,
    legacy: {
      hookPattern: topHook?.text ?? "—",
      slideStructure: `${slidesPerCarousel}-slide ${archetype}`,
      ctaStyle: "Save + share",
      nicheScore: nicheFitScore(strategy),
    },
  };
}
