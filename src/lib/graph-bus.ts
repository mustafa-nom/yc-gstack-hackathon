import { EventEmitter } from "node:events";

export type GraphNodeType = "niche" | "creator" | "hook" | "pattern" | "hashtag";

export type GraphNode = {
  id: string;
  type: GraphNodeType;
  label: string;
  size: number;
  color: string;
  group: number;
  data: unknown;
};

export type GraphEdge = {
  source: string;
  target: string;
  strength?: number;
};

export type GraphEvent =
  | { kind: "nodeAdded"; node: GraphNode }
  | { kind: "nodeUpdated"; id: string; patch: Partial<GraphNode> }
  | { kind: "edgeAdded"; edge: GraphEdge }
  | { kind: "phaseDone"; niche: string; phase: "search" | "deep-research" | "transform" }
  | { kind: "nicheReady"; niche: string; nicheSlug: string }
  | { kind: "allReady" }
  | { kind: "error"; niche?: string; message: string }
  | {
      kind: "log";
      level: "info" | "success" | "warn" | "error";
      message: string;
      scope?: string;
      ts?: string;
    };

class GraphBus extends EventEmitter {
  private buffers = new Map<string, GraphEvent[]>();

  publish(runId: string, event: GraphEvent): void {
    const buf = this.buffers.get(runId) ?? [];
    buf.push(event);
    this.buffers.set(runId, buf);
    this.emit(`run:${runId}`, event);
    this.emit("any", { runId, event });
  }

  subscribe(runId: string, fn: (event: GraphEvent) => void): () => void {
    const handler = (event: GraphEvent) => fn(event);
    this.on(`run:${runId}`, handler);
    return () => this.off(`run:${runId}`, handler);
  }

  replay(runId: string): GraphEvent[] {
    return [...(this.buffers.get(runId) ?? [])];
  }

  clear(runId: string): void {
    this.buffers.delete(runId);
    this.removeAllListeners(`run:${runId}`);
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __graphBus: GraphBus | undefined;
}

export const graphBus: GraphBus =
  globalThis.__graphBus ?? (globalThis.__graphBus = new GraphBus());
