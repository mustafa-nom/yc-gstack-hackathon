"use server";

import { ulid } from "ulid";
import { loadPerformanceFixture, type Learning } from "./performance";
import { extractLearningsFromMetrics } from "@/lib/agents/insights";
import { writeJson } from "@/lib/state";
import { addTimelineEntry, getPage, putPage } from "@/lib/gbrain";
import { nicheSlugFromName } from "@/lib/hog/transformer";
import { POST_DATE_BY_ID, PREVIOUS_POSTS } from "@/lib/performance-posts";

export async function generateInsights(): Promise<Learning> {
  const rows = await loadPerformanceFixture();
  const carousels = rows.map((r) => r.carousel);
  const metrics = rows.map((r) => r.metrics);

  const { patterns } = await extractLearningsFromMetrics({ carousels, metrics });

  const learning: Learning = {
    id: ulid(),
    generatedAt: new Date().toISOString(),
    patterns,
  };
  await writeJson(`learnings/${learning.id}.json`, learning);

  const niches = Array.from(new Set(carousels.map((c) => c.niche)));
  for (const niche of niches) {
    const slug = `niches/${nicheSlugFromName(niche)}`;
    try {
      await addTimelineEntry(
        slug,
        learning.generatedAt,
        `learnings ${learning.id} from ${carousels.length} carousels: ${patterns
          .map((p) => p.pattern)
          .join(" | ")}`,
      );
    } catch {
      // Niche page may not exist yet (no Hog run for it) — non-fatal
    }
  }

  return learning;
}

function engagementRate(post: (typeof PREVIOUS_POSTS)[number]): number {
  if (!post.stats?.views) return 0;
  const interactions = post.stats.likes + post.stats.comments + post.stats.shares;
  return interactions / post.stats.views;
}

function renderPerformanceLearningPage(input: {
  learning: Learning;
  postCount: number;
  topPostTitle: string;
  topPostViews: number;
}): string {
  const lines = [
    "# Performance Learnings",
    "",
    `Generated: ${input.learning.generatedAt}`,
    `Source: ${input.postCount} previous @tylerbrooks.lifts posts`,
    `Top performer: "${input.topPostTitle}" (${input.topPostViews.toLocaleString("en-US")} views)`,
    "",
    "## Learnings",
    "",
  ];

  input.learning.patterns.forEach((pattern, index) => {
    lines.push(
      `### ${index + 1}. ${pattern.pattern}`,
      "",
      `Evidence: ${pattern.evidence}`,
      "",
      `Recommendation: ${pattern.recommendation}`,
      "",
    );
  });

  return lines.join("\n").trimEnd() + "\n";
}

export type GStackLearningWrite = {
  learning: Learning;
  slug: string;
  content: string;
};

export async function generatePerformanceLearningsForGStack(): Promise<GStackLearningWrite> {
  const posts = PREVIOUS_POSTS.filter((post) => post.status === "done" && post.stats)
    .sort((a, b) => (b.stats?.views ?? 0) - (a.stats?.views ?? 0))
    .slice(0, 14);

  const averageViews =
    posts.reduce((sum, post) => sum + (post.stats?.views ?? 0), 0) / Math.max(posts.length, 1);

  const carousels = posts.map((post) => ({
    id: post.id,
    niche: "fitness creator performance",
    hook: post.title,
    archetype: "previous-post",
    slides: [{ title: post.title, body: post.caption ?? "" }],
    createdAt: POST_DATE_BY_ID[post.id] ?? new Date().toISOString(),
  }));

  const metrics = posts.map((post) => {
    const views = post.stats?.views ?? 0;
    return {
      carouselId: post.id,
      predictedViews: Math.round(averageViews),
      actualViews: views,
      likes: post.stats?.likes ?? 0,
      comments: post.stats?.comments ?? 0,
      shares: post.stats?.shares ?? 0,
      saves: Math.round(views * engagementRate(post)),
      completionRate: Math.min(0.95, Math.max(0.2, engagementRate(post) * 8)),
      deltaPct: averageViews > 0 ? Math.round(((views - averageViews) / averageViews) * 100) : 0,
      recordedAt: new Date().toISOString(),
    };
  });

  const { patterns } = await extractLearningsFromMetrics({ carousels, metrics });
  const learning: Learning = {
    id: ulid(),
    generatedAt: new Date().toISOString(),
    patterns,
  };

  await writeJson(`learnings/${learning.id}.json`, learning);

  const topPost = posts[0];
  const body = renderPerformanceLearningPage({
    learning,
    postCount: posts.length,
    topPostTitle: topPost?.title ?? "n/a",
    topPostViews: topPost?.stats?.views ?? 0,
  });
  const slug = "performance/learnings/latest";

  await putPage(
    slug,
    {
      type: "performance-learning",
      title: "Performance Learnings",
      tags: ["performance", "learnings", "gpost"],
      learningId: learning.id,
    },
    body,
  );
  await addTimelineEntry(
    slug,
    learning.generatedAt.slice(0, 10),
    `Generated performance learnings ${learning.id} from ${posts.length} previous posts`,
  );

  const content = (await getPage(slug)) ?? body;
  return { learning, slug, content };
}
