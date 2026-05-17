"use client";

import { useState, useEffect, Suspense } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import type { GraphNode } from "@/lib/graph-bus";
import { DossierPanel } from "@/components/DossierPanel";
import { AgentLogPanel } from "@/components/AgentLogPanel";
import { setStoredRunId } from "@/lib/run-context";

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

  useEffect(() => {
    if (runId) setStoredRunId(runId);
  }, [runId]);

  if (!runId) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted">
        Missing runId. Start from /
      </div>
    );
  }

  const perfHref = `/performance?runId=${encodeURIComponent(runId)}`;

  return (
    <div className="min-h-screen relative bg-background overflow-hidden">
      {/* Position the graph to the right of AgentLogPanel so it centers in the
          actual visible area, not behind the panel. Widths must match the
          panel's responsive breakpoints in AgentLogPanel.tsx. */}
      <div className="fixed inset-y-0 right-0 left-0 sm:left-[460px] lg:left-[520px] z-0">
        <LiveGraph
          runId={runId}
          onNodeSelect={setSelected}
          onNicheReady={(n) =>
            setReadyNiches((prev) => (prev.includes(n) ? prev : [...prev, n]))
          }
          onAllReady={() => setAllReady(true)}
        />
      </div>

      <AgentLogPanel runId={runId} allReady={allReady} niches={readyNiches} />

      <div className="fixed top-4 right-4 z-30 flex items-center gap-2 pointer-events-none">
        {readyNiches.length > 0 && (
          <div className="pointer-events-auto bg-card-bg/80 border border-card-border rounded px-3 py-1.5 backdrop-blur-sm">
            <p className="text-[10px] font-mono uppercase tracking-widest text-muted">
              {readyNiches.length} / 3 niches ready
            </p>
          </div>
        )}
        <a
          href={perfHref}
          className="pointer-events-auto bg-card-bg/80 border border-card-border rounded px-3 py-1.5 backdrop-blur-sm text-[10px] font-mono uppercase tracking-widest text-muted hover:text-foreground transition-colors"
        >
          Performance →
        </a>
      </div>

      <div className="fixed top-5 left-4 sm:left-[476px] lg:left-[536px] z-20 pointer-events-none font-mono">
        <p className="text-[22px] font-bold tracking-tight leading-none text-foreground/90">
          GPost
        </p>
        <p className="text-[9px] uppercase tracking-widest text-muted/60 mt-1.5">
          live ingestion · niche graph
        </p>
      </div>

      <DossierPanel node={selected} onClose={() => setSelected(null)} />
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
