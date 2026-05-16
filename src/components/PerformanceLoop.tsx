"use client";

import { useEffect, useState, useTransition } from "react";
import { motion } from "motion/react";
import { Loader2, RefreshCw, Sparkles } from "lucide-react";
import {
  loadPerformanceFixture,
  loadLatestLearning,
  type PerformanceRow,
  type Learning,
} from "@/app/actions/performance";
import { generateInsights } from "@/app/actions/insights";
import { incorporateFeedback } from "@/app/actions/regenerate";

function formatViews(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function PerformanceLoop() {
  const [rows, setRows] = useState<PerformanceRow[]>([]);
  const [learning, setLearning] = useState<Learning | null>(null);
  const [newCarousel, setNewCarousel] = useState<{
    hook: string;
    archetype: string;
    niche: string;
    slides: { title: string; body: string }[];
  } | null>(null);
  const [insightsPending, startInsights] = useTransition();
  const [feedbackPending, startFeedback] = useTransition();
  const [status, setStatus] = useState<string>("");

  useEffect(() => {
    (async () => {
      const [r, l] = await Promise.all([
        loadPerformanceFixture(),
        loadLatestLearning(),
      ]);
      setRows(r);
      setLearning(l);
    })();
  }, []);

  function onGenerateInsights() {
    setStatus("Reading 7 carousels and metrics…");
    startInsights(async () => {
      try {
        const result = await generateInsights();
        setLearning(result);
        setStatus("Insights written to GBrain timeline.");
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setStatus(`error: ${msg}`);
      }
    });
  }

  function onIncorporate() {
    if (!learning) {
      setStatus("Generate insights first.");
      return;
    }
    setStatus("Generating new carousel with learnings…");
    startFeedback(async () => {
      try {
        const result = await incorporateFeedback({ learningId: learning.id });
        setNewCarousel(result);
        setStatus(`New carousel generated · archetype: ${result.archetype}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setStatus(`error: ${msg}`);
      }
    });
  }

  return (
    <div>
      <div className="mb-10">
        <h1 className="text-2xl font-semibold tracking-tight">Performance</h1>
        <p className="text-sm text-muted mt-1">
          Track results and see what the AI learned.
        </p>
      </div>

      <section className="mb-12">
        <h2 className="text-xs text-muted uppercase tracking-widest mb-5 font-medium">
          Recent posts ({rows.length})
        </h2>
        <div className="space-y-2">
          {rows.map((row, i) => (
            <motion.div
              key={row.carousel.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: i * 0.04, ease: [0.16, 1, 0.3, 1] }}
              className="flex items-center gap-4 bg-card-bg border border-card-border rounded-xl px-5 py-4"
            >
              <span className="text-xs text-muted font-mono w-14 shrink-0">
                {fmtDate(row.carousel.createdAt)}
              </span>
              <span className="text-[10px] text-muted/60 uppercase tracking-widest w-28 shrink-0 truncate">
                {row.carousel.niche}
              </span>
              <span className="text-sm font-medium flex-1 truncate">
                {row.carousel.hook}
              </span>
              <span className="text-[10px] text-muted/60 uppercase tracking-widest w-20 text-right shrink-0 hidden sm:inline">
                {row.carousel.archetype}
              </span>
              <span className="text-sm font-mono w-16 text-right">
                {formatViews(row.metrics.actualViews)}
              </span>
              <span
                className={`text-xs font-mono font-medium w-14 text-right ${
                  row.metrics.deltaPct >= 0 ? "text-success" : "text-danger"
                }`}
              >
                {row.metrics.deltaPct >= 0 ? "+" : ""}
                {row.metrics.deltaPct}%
              </span>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="mb-12">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xs text-muted uppercase tracking-widest font-medium">
            AI Learning
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={onGenerateInsights}
              disabled={insightsPending}
              className="inline-flex items-center gap-1.5 bg-accent hover:bg-accent-hover text-white text-xs px-3 py-1.5 rounded font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-wait"
            >
              {insightsPending ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Sparkles className="w-3 h-3" />
              )}
              Generate insights
            </button>
            <button
              onClick={onIncorporate}
              disabled={feedbackPending || !learning}
              className="inline-flex items-center gap-1.5 bg-foreground hover:bg-foreground/90 text-background text-xs px-3 py-1.5 rounded font-medium transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {feedbackPending ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <RefreshCw className="w-3 h-3" />
              )}
              Incorporate feedback
            </button>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="bg-card-bg border border-card-border rounded-xl p-6"
        >
          {learning ? (
            <div className="space-y-3 text-sm text-foreground/80 leading-relaxed">
              {learning.patterns.map((p, i) => (
                <p key={i}>
                  <span className="text-accent mr-2">→</span>
                  <span className="font-medium text-foreground">{p.pattern}</span>
                  <span className="text-muted"> — {p.evidence}</span>
                  <br />
                  <span className="text-foreground/60 text-xs ml-5 italic">
                    {p.recommendation}
                  </span>
                </p>
              ))}
              <p className="text-[10px] text-muted/50 mt-5 font-mono">
                generated {fmtDate(learning.generatedAt)}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted">
              No learnings yet. Click <span className="text-accent">Generate insights</span> to
              extract patterns from the 7 posts above.
            </p>
          )}
          {status && (
            <p className="text-[10px] text-muted/60 mt-3 font-mono">{status}</p>
          )}
        </motion.div>
      </section>

      {newCarousel && (
        <section>
          <h2 className="text-xs text-muted uppercase tracking-widest mb-5 font-medium">
            Next carousel (feedback-informed)
          </h2>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="bg-card-bg border border-card-border rounded-xl p-6"
          >
            <p className="text-[10px] uppercase tracking-widest text-muted font-mono mb-1">
              {newCarousel.niche} · {newCarousel.archetype}
            </p>
            <h3 className="text-lg font-semibold mb-4 leading-snug">
              {newCarousel.hook}
            </h3>
            <ol className="space-y-2 text-sm">
              {newCarousel.slides.map((s, i) => (
                <li key={i} className="text-foreground/80">
                  <span className="text-muted mr-2 font-mono text-xs">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="font-medium">{s.title}</span>
                  <p className="text-muted text-xs mt-1 ml-6">{s.body}</p>
                </li>
              ))}
            </ol>
          </motion.div>
        </section>
      )}
    </div>
  );
}
