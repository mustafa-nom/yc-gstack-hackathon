"use server";

import { readJson, listJson } from "@/lib/state";

export type Carousel = {
  id: string;
  niche: string;
  hook: string;
  archetype: string;
  slides: { title: string; body: string }[];
  createdAt: string;
};

export type Metrics = {
  carouselId: string;
  predictedViews: number;
  actualViews: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  completionRate: number;
  deltaPct: number;
  recordedAt: string;
};

export type PerformanceRow = {
  carousel: Carousel;
  metrics: Metrics;
};

export async function loadPerformanceFixture(): Promise<PerformanceRow[]> {
  const entries = await listJson("carousels");
  const rows: PerformanceRow[] = [];
  for (const name of entries.sort()) {
    const id = name.replace(/\.json$/, "");
    const carousel = await readJson<Carousel>(`carousels/${name}`);
    const metrics = await readJson<Metrics>(`metrics/${id}.json`);
    if (carousel && metrics) rows.push({ carousel, metrics });
  }
  return rows.sort((a, b) =>
    b.carousel.createdAt.localeCompare(a.carousel.createdAt),
  );
}

export type Learning = {
  id: string;
  generatedAt: string;
  patterns: {
    pattern: string;
    evidence: string;
    recommendation: string;
  }[];
};

export async function loadLatestLearning(): Promise<Learning | null> {
  const entries = (await listJson("learnings")).sort();
  if (!entries.length) return null;
  const latest = entries[entries.length - 1];
  return readJson<Learning>(`learnings/${latest}`);
}
