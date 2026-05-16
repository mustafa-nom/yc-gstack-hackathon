"use client";

import { useState, Suspense } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import type { GraphNode } from "@/lib/graph-bus";
import { DossierPanel } from "@/components/DossierPanel";
import { NicheStrategyPanel } from "@/components/NicheStrategyPanel";
import { AgentLogPanel } from "@/components/AgentLogPanel";

const LiveGraph = dynamic(
  () => import("@/components/LiveGraph").then((m) => m.LiveGraph),
  { ssr: false },
);

function GraphPageInner() {
  const params = useSearchParams();
  const runId = params.get("runId") ?? "";
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [readyNiches, setReadyNiches] = useState<string[]>([]);
  const [allReady, setAllReady] = useState(false);

  if (!runId) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted">
        Missing runId. Start from /
      </div>
    );
  }

  return (
    <div className="min-h-screen relative bg-background overflow-hidden">
      <LiveGraph
        runId={runId}
        onNodeSelect={setSelected}
        onNicheReady={(n) =>
          setReadyNiches((prev) => (prev.includes(n) ? prev : [...prev, n]))
        }
        onAllReady={() => setAllReady(true)}
      />

      <AgentLogPanel runId={runId} allReady={allReady} />

      <div className="fixed top-4 right-4 z-30 flex items-center gap-2 pointer-events-none">
        {readyNiches.length > 0 && (
          <div className="pointer-events-auto bg-card-bg/80 border border-card-border rounded px-3 py-1.5 backdrop-blur-sm">
            <p className="text-[10px] font-mono uppercase tracking-widest text-muted">
              {readyNiches.length} / 3 niches ready
            </p>
          </div>
        )}
        <a
          href="/performance"
          className="pointer-events-auto bg-card-bg/80 border border-card-border rounded px-3 py-1.5 backdrop-blur-sm text-[10px] font-mono uppercase tracking-widest text-muted hover:text-foreground transition-colors"
        >
          Performance →
        </a>
      </div>

      <div className="fixed bottom-5 left-[400px] z-20 pointer-events-none font-mono">
        <p className="text-[28px] font-bold tracking-tight leading-none text-foreground/90">
          BrainPost
        </p>
        <p className="text-[10px] uppercase tracking-widest text-muted/60 mt-1">
          live ingestion · niche graph
        </p>
      </div>

      <DossierPanel node={selected} onClose={() => setSelected(null)} />

      <NicheStrategyPanel niches={readyNiches} visible={allReady} />
    </div>
  );
}

export default function GraphPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <GraphPageInner />
    </Suspense>
  );
}
