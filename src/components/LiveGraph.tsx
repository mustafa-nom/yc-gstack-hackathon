"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { GraphEvent, GraphNode, GraphEdge } from "@/lib/graph-bus";

type ForceNode = GraphNode & { __threeObj?: unknown; x?: number; y?: number; z?: number };
type ForceLink = { source: string | ForceNode; target: string | ForceNode; strength?: number };

type ForceGraph3DInstance = {
  graphData: (data: { nodes: ForceNode[]; links: ForceLink[] }) => ForceGraph3DInstance;
  nodeThreeObject: (fn: (node: ForceNode) => unknown) => ForceGraph3DInstance;
  nodeThreeObjectExtend: (val: boolean) => ForceGraph3DInstance;
  linkColor: (fn: (link: ForceLink) => string) => ForceGraph3DInstance;
  linkOpacity: (val: number) => ForceGraph3DInstance;
  linkWidth: (fn: (link: ForceLink) => number) => ForceGraph3DInstance;
  linkDirectionalParticles: (fn: (link: ForceLink) => number) => ForceGraph3DInstance;
  linkDirectionalParticleWidth: (val: number) => ForceGraph3DInstance;
  linkDirectionalParticleSpeed: (val: number) => ForceGraph3DInstance;
  linkDirectionalParticleColor: (fn: () => string) => ForceGraph3DInstance;
  backgroundColor: (color: string) => ForceGraph3DInstance;
  onNodeClick: (fn: (node: ForceNode) => void) => ForceGraph3DInstance;
  onNodeHover: (fn: (node: ForceNode | null) => void) => ForceGraph3DInstance;
  d3Force: (name: string, force?: unknown) => unknown;
  cameraPosition: (
    pos: { x: number; y: number; z: number },
    lookAt?: { x: number; y: number; z: number },
    ms?: number,
  ) => void;
  scene: () => { add: (obj: unknown) => void };
  width: (val: number) => ForceGraph3DInstance;
  height: (val: number) => ForceGraph3DInstance;
  showNavInfo: (val: boolean) => ForceGraph3DInstance;
  enableNodeDrag: (val: boolean) => ForceGraph3DInstance;
  warmupTicks: (val: number) => ForceGraph3DInstance;
  cooldownTicks: (val: number) => ForceGraph3DInstance;
  refresh: () => void;
  renderer: () => unknown;
  camera: () => unknown;
  postProcessingComposer: (composer: unknown) => unknown;
  _destructor: () => void;
};

export type LiveGraphProps = {
  runId: string;
  onNodeSelect?: (node: GraphNode) => void;
  onAllReady?: () => void;
  onNicheReady?: (niche: string) => void;
};

export function LiveGraph({ runId, onNodeSelect, onAllReady, onNicheReady }: LiveGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<ForceGraph3DInstance | null>(null);
  const nodesRef = useRef<Map<string, ForceNode>>(new Map());
  const edgesRef = useRef<ForceLink[]>([]);
  const pendingEdgesRef = useRef<ForceLink[]>([]);
  const dirtyRef = useRef(false);
  const [hoveredNode, setHoveredNode] = useState<ForceNode | null>(null);
  const [phaseMsg, setPhaseMsg] = useState<string>("");

  const flush = useCallback(() => {
    if (!graphRef.current) return;
    if (!dirtyRef.current) return;
    dirtyRef.current = false;
    graphRef.current.graphData({
      nodes: Array.from(nodesRef.current.values()),
      links: edgesRef.current,
    });
  }, []);

  const drainPendingEdges = useCallback(() => {
    if (pendingEdgesRef.current.length === 0) return;
    const stillPending: ForceLink[] = [];
    for (const link of pendingEdgesRef.current) {
      const s = typeof link.source === "string" ? link.source : (link.source as ForceNode).id;
      const t = typeof link.target === "string" ? link.target : (link.target as ForceNode).id;
      if (nodesRef.current.has(s) && nodesRef.current.has(t)) {
        edgesRef.current.push(link);
        dirtyRef.current = true;
      } else {
        stillPending.push(link);
      }
    }
    pendingEdgesRef.current = stillPending;
  }, []);

  const handleEvent = useCallback(
    (event: GraphEvent) => {
      switch (event.kind) {
        case "nodeAdded": {
          if (!nodesRef.current.has(event.node.id)) {
            nodesRef.current.set(event.node.id, event.node as ForceNode);
            dirtyRef.current = true;
            drainPendingEdges();
          }
          break;
        }
        case "nodeUpdated": {
          const existing = nodesRef.current.get(event.id);
          if (existing) {
            nodesRef.current.set(event.id, { ...existing, ...event.patch } as ForceNode);
            dirtyRef.current = true;
          }
          break;
        }
        case "edgeAdded": {
          const link: ForceLink = {
            source: event.edge.source,
            target: event.edge.target,
            strength: event.edge.strength,
          };
          if (
            nodesRef.current.has(event.edge.source) &&
            nodesRef.current.has(event.edge.target)
          ) {
            edgesRef.current.push(link);
            dirtyRef.current = true;
          } else {
            pendingEdgesRef.current.push(link);
          }
          break;
        }
        case "phaseDone": {
          setPhaseMsg(`${event.niche}: ${event.phase} ✓`);
          break;
        }
        case "nicheReady": {
          setPhaseMsg(`${event.niche} ready`);
          onNicheReady?.(event.niche);
          break;
        }
        case "allReady": {
          setPhaseMsg("All niches ready");
          onAllReady?.();
          break;
        }
        case "error": {
          setPhaseMsg(`error: ${event.niche ?? ""} ${event.message}`);
          break;
        }
      }
    },
    [onAllReady, onNicheReady, drainPendingEdges],
  );

  useEffect(() => {
    const url = `/api/graph/stream?runId=${encodeURIComponent(runId)}`;
    const es = new EventSource(url);
    es.onmessage = (m) => {
      try {
        handleEvent(JSON.parse(m.data) as GraphEvent);
      } catch {}
    };
    es.onerror = () => {
      // Browser will retry; ignore transient blips.
    };
    return () => es.close();
  }, [runId, handleEvent]);

  useEffect(() => {
    const interval = setInterval(flush, 120);
    return () => clearInterval(interval);
  }, [flush]);

  useEffect(() => {
    let cancelled = false;
    let removeResize: (() => void) | undefined;

    (async () => {
      if (!containerRef.current || graphRef.current) return;
      const mod = await import("3d-force-graph");
      const ForceGraph3D = mod.default as unknown as (el: HTMLElement) => ForceGraph3DInstance;
      const THREE = await import("three");
      if (cancelled || !containerRef.current) return;

      const graph = ForceGraph3D(containerRef.current);
      graphRef.current = graph;

      graph
        .backgroundColor("#09090b")
        .showNavInfo(false)
        .enableNodeDrag(false)
        .warmupTicks(60)
        .cooldownTicks(40)
        .graphData({ nodes: [], links: [] })
        .nodeThreeObject((node: ForceNode) => {
          const group = new THREE.Group();
          const isNiche = node.type === "niche";
          const isCreator = node.type === "creator";
          const size = node.size ?? 3;
          const color = new THREE.Color(node.color || "#9ca3af");

          if (isNiche) {
            const core = new THREE.Mesh(
              new THREE.SphereGeometry(size * 0.55, 24, 18),
              new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 }),
            );
            group.add(core);

            const shell = new THREE.Mesh(
              new THREE.SphereGeometry(size, 24, 18),
              new THREE.MeshBasicMaterial({
                color,
                transparent: true,
                opacity: 0.18,
                wireframe: true,
              }),
            );
            group.add(shell);

            const halo = new THREE.Mesh(
              new THREE.SphereGeometry(size * 1.8, 24, 18),
              new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.05 }),
            );
            group.add(halo);

            const ring = new THREE.Mesh(
              new THREE.RingGeometry(size * 1.15, size * 1.25, 64),
              new THREE.MeshBasicMaterial({
                color,
                transparent: true,
                opacity: 0.35,
                side: THREE.DoubleSide,
              }),
            );
            ring.rotation.x = Math.PI / 2;
            group.add(ring);
          } else {
            const sphere = new THREE.Mesh(
              new THREE.SphereGeometry(size, 16, 12),
              new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 }),
            );
            group.add(sphere);

            const glow = new THREE.Mesh(
              new THREE.SphereGeometry(size * 1.7, 16, 12),
              new THREE.MeshBasicMaterial({
                color,
                transparent: true,
                opacity: isCreator ? 0.16 : 0.1,
              }),
            );
            group.add(glow);
          }

          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d")!;
          canvas.width = 320;
          canvas.height = 64;
          ctx.font = `${isNiche ? "bold 18px" : isCreator ? "13px" : "11px"} ui-monospace, SFMono-Regular, monospace`;
          ctx.fillStyle = isNiche ? "#fafafa" : isCreator ? "#d4d4d8" : "#a1a1aa";
          ctx.textAlign = "center";
          const label = (node.label ?? node.id).slice(0, 40);
          if (isNiche) {
            ctx.fillText(label.toUpperCase(), 160, 38);
          } else {
            ctx.fillText(label, 160, 38);
          }

          const texture = new THREE.CanvasTexture(canvas);
          texture.needsUpdate = true;
          const sprite = new THREE.Sprite(
            new THREE.SpriteMaterial({
              map: texture,
              transparent: true,
              opacity: isNiche ? 1 : 0.78,
              depthWrite: false,
            }),
          );
          const spriteScale = isNiche ? 40 : 30;
          sprite.scale.set(spriteScale, spriteScale / 4, 1);
          sprite.position.y = isNiche ? size + 5 : size + 4;
          group.add(sprite);

          return group;
        })
        .nodeThreeObjectExtend(false)
        .linkColor((link: ForceLink) => {
          const a = Math.round(40 + (link.strength ?? 0.3) * 70);
          return `rgba(160,160,160,${a / 255})`;
        })
        .linkOpacity(0.35)
        .linkWidth((link: ForceLink) => 0.4 + (link.strength ?? 0.3) * 1.2)
        .linkDirectionalParticles((link: ForceLink) => ((link.strength ?? 0.3) > 1 ? 2 : 1))
        .linkDirectionalParticleWidth(1.0)
        .linkDirectionalParticleSpeed(0.004)
        .linkDirectionalParticleColor(() => "#BFCBDA")
        .onNodeHover((n) => {
          setHoveredNode(n);
          if (containerRef.current) containerRef.current.style.cursor = n ? "pointer" : "default";
        })
        .onNodeClick((n) => onNodeSelect?.(n as GraphNode));

      const forceLink = graph.d3Force("link") as { distance?: (fn: () => number) => void } | null;
      forceLink?.distance?.(() => 60 + Math.random() * 40);
      const forceCharge = graph.d3Force("charge") as { strength?: (fn: () => number) => void } | null;
      forceCharge?.strength?.(() => -160);

      try {
        const { EffectComposer } = await import("three/examples/jsm/postprocessing/EffectComposer.js");
        const { RenderPass } = await import("three/examples/jsm/postprocessing/RenderPass.js");
        const { UnrealBloomPass } = await import("three/examples/jsm/postprocessing/UnrealBloomPass.js");
        const renderer = graph.renderer();
        const scene = graph.scene();
        const camera = graph.camera();
        if (renderer && scene && camera) {
          const composer = new EffectComposer(
            renderer as InstanceType<typeof THREE.WebGLRenderer>,
          );
          composer.addPass(
            new RenderPass(
              scene as unknown as InstanceType<typeof THREE.Scene>,
              camera as InstanceType<typeof THREE.Camera>,
            ),
          );
          composer.addPass(
            new UnrealBloomPass(
              new THREE.Vector2(window.innerWidth, window.innerHeight),
              1.35,
              0.45,
              0.28,
            ),
          );
          graph.postProcessingComposer(composer);
        }
      } catch {
        // bloom optional — silently fall back to plain render
      }

      graph.cameraPosition({ x: 0, y: 0, z: 6 }, { x: 0, y: 0, z: 0 }, 0);
      setTimeout(
        () => graph.cameraPosition({ x: 120, y: 90, z: 480 }, { x: 0, y: 0, z: 0 }, 3500),
        200,
      );

      const handleResize = () => {
        graphRef.current?.width(window.innerWidth);
        graphRef.current?.height(window.innerHeight);
      };
      window.addEventListener("resize", handleResize);
      removeResize = () => window.removeEventListener("resize", handleResize);
    })();

    return () => {
      cancelled = true;
      removeResize?.();
      if (graphRef.current) {
        try {
          graphRef.current._destructor();
        } catch {}
        graphRef.current = null;
      }
    };
  }, [onNodeSelect]);

  return (
    <>
      <div ref={containerRef} className="fixed inset-0 z-0" />
      {phaseMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-30 bg-black/60 border border-white/10 rounded px-3 py-1.5 backdrop-blur-sm">
          <span className="text-[11px] text-white/80 font-mono">{phaseMsg}</span>
        </div>
      )}
      {hoveredNode && (
        <div
          className="fixed z-30 pointer-events-none bg-black/70 border border-white/10 rounded px-3 py-2 backdrop-blur-sm"
          style={{ top: "50%", left: "50%", transform: "translate(-50%, -120%)" }}
        >
          <div className="flex items-center gap-2">
            <div
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: hoveredNode.color || "#999" }}
            />
            <span className="uppercase tracking-widest text-[10px] text-white/90 font-mono">
              {hoveredNode.label}
            </span>
          </div>
          <p className="text-[9px] text-white/40 mt-1 font-mono">
            {hoveredNode.type.toUpperCase()}
          </p>
        </div>
      )}
    </>
  );
}
