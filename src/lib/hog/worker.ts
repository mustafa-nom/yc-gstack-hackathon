import {
  searchHog,
  buildSearchQuery,
} from "./client";
import { transformAndWrite, nicheSlugFromName } from "./transformer";
import { strategyToGraph } from "../graph-store";
import { graphBus } from "../graph-bus";
import { synthesizeStrategyFromCaptions } from "../agents/synthesize";
import type { Strategy } from "./schema";

export type NicheRunInput = {
  runId: string;
  niche: string;
  group: number;
  projectId?: string;
};

export type NicheRunResult = {
  niche: string;
  nicheSlug: string;
  strategy?: Strategy;
  degraded: boolean;
  error?: string;
};

export async function runNicheIngestion(
  input: NicheRunInput,
): Promise<NicheRunResult> {
  const { runId, niche, group } = input;
  const nicheSlug = nicheSlugFromName(niche);
  const publish = (event: Parameters<typeof graphBus.publish>[1]) =>
    graphBus.publish(runId, event);
  const log = (
    message: string,
    level: "info" | "success" | "warn" | "error" = "info",
  ) =>
    publish({
      kind: "log",
      level,
      message,
      scope: niche,
      ts: new Date().toISOString(),
    });

  publish({
    kind: "nodeAdded",
    node: {
      id: `niche:${nicheSlug}`,
      type: "niche",
      label: niche,
      size: 14,
      color: "#d4745f",
      group,
      data: { niche, slug: nicheSlug, status: "searching" },
    },
  });

  log(`Searching Hog for "${niche}"`);
  let captions: Awaited<ReturnType<typeof searchHog>>["items"] = [];
  try {
    const searchResult = await searchHog(buildSearchQuery(niche), {
      nicheSlug,
      onTick: (status) =>
        publish({
          kind: "nodeUpdated",
          id: `niche:${nicheSlug}`,
          patch: { data: { niche, slug: nicheSlug, phase: "search", status } },
        }),
    });
    captions = searchResult.items.filter((it) => {
      const c = (it.content ?? "").trim();
      return c.length > 20 && !/^\[.*\]$/.test(c);
    });
    publish({ kind: "phaseDone", niche, phase: "search" });
    log(`Got ${captions.length} usable TikTok captions from Hog`, "success");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    publish({ kind: "error", niche, message: `search failed: ${msg}` });
    log(`search failed: ${msg}`, "error");
  }

  if (captions.length === 0) {
    const msg = "no captions from Hog — cannot synthesize strategy";
    publish({ kind: "error", niche, message: msg });
    log(msg, "error");
    return { niche, nicheSlug, degraded: true, error: msg };
  }

  let strategy: Strategy;
  try {
    log(`Synthesizing strategy from ${captions.length} captions via Claude`);
    strategy = await synthesizeStrategyFromCaptions({ niche, items: captions });
    publish({ kind: "phaseDone", niche, phase: "deep-research" });
    log(
      `Strategy ready · ${strategy.hooks.length} hooks · ${strategy.creators.length} creators · ${strategy.hashtags.primary_cluster.length} hashtags`,
      "success",
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    publish({ kind: "error", niche, message: `synthesis failed: ${msg}` });
    log(`synthesis failed: ${msg}`, "error");
    return { niche, nicheSlug, degraded: true, error: msg };
  }

  const { nodes, edges } = strategyToGraph(
    { ...strategy, niche_slug: niche },
    group,
  );
  for (const node of nodes) {
    if (node.id === `niche:${nicheSlug}`) {
      publish({
        kind: "nodeUpdated",
        id: node.id,
        patch: {
          label: node.label,
          color: node.color,
          data: { ...(node.data as Record<string, unknown>), phase: "ready" },
        },
      });
    } else {
      publish({ kind: "nodeAdded", node });
    }
  }
  for (const edge of edges) {
    publish({ kind: "edgeAdded", edge });
  }

  publish({
    kind: "nodeUpdated",
    id: `niche:${nicheSlug}`,
    patch: {
      data: {
        niche,
        slug: nicheSlug,
        status: "ready",
        summary: strategy.niche_summary,
        hookCount: strategy.hooks.length,
        creatorCount: strategy.creators.length,
        hashtagCount:
          strategy.hashtags.primary_cluster.length +
          (strategy.hashtags.trending?.length ?? 0),
        topHooks: strategy.hooks.slice(0, 3).map((h) => h.text),
        primaryHashtags: strategy.hashtags.primary_cluster.slice(0, 6),
        topCreators: strategy.creators.slice(0, 5).map((c) => c.handle),
      },
    },
  });

  log("Writing GBrain pages (compiled truth + timeline)");
  try {
    await transformAndWrite(strategy, { runId, niche });
    publish({ kind: "phaseDone", niche, phase: "transform" });
    log("GBrain pages written", "success");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    publish({ kind: "error", niche, message: `transform failed: ${msg}` });
    log(`transform failed: ${msg}`, "error");
    return { niche, nicheSlug, strategy, degraded: true, error: msg };
  }

  publish({ kind: "nicheReady", niche, nicheSlug });
  return { niche, nicheSlug, strategy, degraded: false };
}
