import { createHash } from "node:crypto";
import type { GraphNode, GraphEdge } from "./graph-bus";
import type {
  CreatorEntry,
  HookEntry,
  Strategy,
} from "./hog/schema";
import {
  nicheSlugFromName,
  creatorSlugFromHandle,
  archetypeSlug,
} from "./slugs";

function archetypeSlugFromHook(h: HookEntry): string {
  return archetypeSlug(h.archetype);
}

const NICHE_PALETTE = [
  "#d4745f",
  "#5fb4d4",
  "#a06fd4",
  "#5fd49f",
  "#d4c25f",
  "#d45fb4",
];

export function nicheColor(group: number): string {
  return NICHE_PALETTE[group % NICHE_PALETTE.length];
}

function sha(s: string): string {
  return createHash("sha1").update(s).digest("hex").slice(0, 10);
}

export function nicheNode(niche: string, group: number): GraphNode {
  return {
    id: `niche:${nicheSlugFromName(niche)}`,
    type: "niche",
    label: niche,
    size: 8,
    color: nicheColor(group),
    group,
    data: { niche, slug: nicheSlugFromName(niche) },
  };
}

export function creatorNode(
  c: CreatorEntry | { handle: string },
  group: number,
): GraphNode {
  const slug = creatorSlugFromHandle(c.handle);
  return {
    id: `creator:${slug}`,
    type: "creator",
    label: `@${c.handle.replace(/^@/, "")}`,
    size: 4,
    color: "#9ca3af",
    group,
    data: c,
  };
}

export function hookNode(h: HookEntry, group: number, nicheSlug: string): GraphNode {
  return {
    id: `hook:${sha(h.text + h.creator_handle + nicheSlug)}`,
    type: "hook",
    label: h.text.slice(0, 40) + (h.text.length > 40 ? "…" : ""),
    size: 2.5,
    color: "#fbbf24",
    group,
    data: { ...h, niche: nicheSlug },
  };
}

export function patternNode(archetype: string, group: number): GraphNode {
  return {
    id: `pattern:${archetype}`,
    type: "pattern",
    label: archetype,
    size: 3,
    color: "#a78bfa",
    group,
    data: { archetype },
  };
}

export function hashtagNode(tag: string, group: number): GraphNode {
  const clean = tag.replace(/^#/, "").toLowerCase();
  return {
    id: `hashtag:${clean}`,
    type: "hashtag",
    label: `#${clean}`,
    size: 1.5,
    color: "#4ade80",
    group,
    data: { tag: clean },
  };
}

export function edge(from: string, to: string, strength = 1): GraphEdge {
  return { source: from, target: to, strength };
}

export type StrategyToGraph = {
  nodes: GraphNode[];
  edges: GraphEdge[];
};

export function strategyToGraph(s: Strategy, group: number): StrategyToGraph {
  const niche = nicheNode(s.niche_slug, group);
  const nodes: GraphNode[] = [niche];
  const edges: GraphEdge[] = [];
  const nicheSlug = nicheSlugFromName(s.niche_slug);

  const creatorIds = new Map<string, string>();
  for (const c of s.creators) {
    const n = creatorNode(c, group);
    nodes.push(n);
    creatorIds.set(c.handle, n.id);
    edges.push(edge(niche.id, n.id));
  }

  const patternIds = new Map<string, string>();
  for (const h of s.hooks) {
    const a = archetypeSlugFromHook(h);
    if (!patternIds.has(a)) {
      const p = patternNode(a, group);
      nodes.push(p);
      patternIds.set(a, p.id);
      edges.push(edge(niche.id, p.id, 0.6));
    }
  }

  for (const h of s.hooks) {
    const hn = hookNode(h, group, nicheSlug);
    nodes.push(hn);

    let cid = creatorIds.get(h.creator_handle);
    if (!cid) {
      const c = creatorNode({ handle: h.creator_handle }, group);
      nodes.push(c);
      creatorIds.set(h.creator_handle, c.id);
      edges.push(edge(niche.id, c.id));
      cid = c.id;
    }
    edges.push(edge(cid, hn.id, 1.4));

    const pid = patternIds.get(archetypeSlugFromHook(h));
    if (pid) edges.push(edge(pid, hn.id, 1.1));
  }

  const seenTag = new Set<string>();
  for (const t of [
    ...s.hashtags.primary_cluster,
    ...(s.hashtags.trending ?? []),
  ]) {
    const clean = t.replace(/^#/, "").toLowerCase();
    if (seenTag.has(clean)) continue;
    seenTag.add(clean);
    const hn = hashtagNode(clean, group);
    nodes.push(hn);
    edges.push(edge(niche.id, hn.id, 0.4));
  }

  return { nodes, edges };
}
