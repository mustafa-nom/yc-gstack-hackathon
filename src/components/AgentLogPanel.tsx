"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Loader2,
  Sparkles,
  CircleAlert,
  CircleCheck,
  ArrowRight,
  Check,
  Send,
} from "lucide-react";
import type { GraphEvent } from "@/lib/graph-bus";
import { generateDesigns } from "@/app/actions/generate-designs";
import { pushToTiktok } from "@/app/actions/push-to-tiktok";
import { nicheSlugFromName } from "@/lib/slugs";
import {
  ChainOfThought,
  ChainOfThoughtContent,
  ChainOfThoughtItem,
  ChainOfThoughtStep,
  ChainOfThoughtTrigger,
} from "@/components/prompt-kit/chain-of-thought";
import { GPostLogo } from "@/components/GPostLogo";

type LogLine = {
  ts: string;
  level: "info" | "success" | "warn" | "error";
  message: string;
  scope?: string;
};

type NicheStatus = "ready" | "generating" | "designed" | "pushing" | "pushed";

type NicheRowState = {
  status: NicheStatus;
  message?: string;
};

function levelColor(level: LogLine["level"]): string {
  switch (level) {
    case "success":
      return "text-success";
    case "warn":
      return "text-accent";
    case "error":
      return "text-danger";
    default:
      return "text-foreground/70";
  }
}

function levelGlyph(level: LogLine["level"]) {
  switch (level) {
    case "success":
      return <CircleCheck className="w-3 h-3 text-success" />;
    case "warn":
      return <Sparkles className="w-3 h-3 text-accent" />;
    case "error":
      return <CircleAlert className="w-3 h-3 text-danger" />;
    default:
      return <Loader2 className="w-3 h-3 text-muted animate-spin [animation-duration:3s]" />;
  }
}

function fmtTime(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", { hour12: false }).slice(0, 8);
}

export function AgentLogPanel({
  runId,
  allReady,
  niches,
}: {
  runId: string;
  allReady: boolean;
  niches: string[];
}) {
  const [lines, setLines] = useState<LogLine[]>([]);
  const [rowState, setRowState] = useState<Record<string, NicheRowState>>({});
  const [, startTransition] = useTransition();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!runId) return;
    const url = `/api/graph/stream?runId=${encodeURIComponent(runId)}`;
    const es = new EventSource(url);
    es.onmessage = (m) => {
      try {
        const ev = JSON.parse(m.data) as GraphEvent;
        if (ev.kind === "log") {
          setLines((prev) => [
            ...prev,
            {
              ts: ev.ts ?? new Date().toISOString(),
              level: ev.level,
              message: ev.message,
              scope: ev.scope,
            },
          ]);
        }
      } catch {}
    };
    return () => es.close();
  }, [runId]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [lines.length, allReady, niches.length]);

  function setStatus(niche: string, patch: Partial<NicheRowState>) {
    setRowState((prev) => {
      const current = prev[niche] ?? { status: "ready" as NicheStatus };
      return { ...prev, [niche]: { ...current, ...patch } };
    });
  }

  async function onGenerate(niche: string) {
    setStatus(niche, { status: "generating", message: "Generating designs…" });
    startTransition(async () => {
      try {
        const result = await generateDesigns({ niche });
        setStatus(niche, {
          status: "designed",
          message: result.mocked
            ? `Mock designs ready`
            : `Designs ready (exit ${result.exitCode})`,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setStatus(niche, { status: "ready", message: `error: ${msg}` });
      }
    });
  }

  async function onPush(niche: string) {
    setStatus(niche, { status: "pushing", message: "Pushing to TikTok…" });
    startTransition(async () => {
      try {
        const result = await pushToTiktok({ nicheSlug: nicheSlugFromName(niche) });
        setStatus(niche, { status: "pushed", message: result.message });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setStatus(niche, { status: "designed", message: `error: ${msg}` });
      }
    });
  }

  return (
    <aside className="fixed top-0 bottom-0 left-0 z-20 w-full sm:w-[460px] lg:w-[520px] flex flex-col">
      <div className="h-full flex flex-col bg-card-bg/85 border-r border-card-border backdrop-blur-md">
        <header className="px-5 py-4 border-b border-card-border flex items-center gap-2.5">
          <GPostLogo size={22} />
          <p className="text-[13px] font-semibold tracking-tight text-foreground">
            GPost Agent
          </p>
        </header>

        <div
          ref={scrollerRef}
          data-lenis-prevent
          className="flex-1 overflow-y-auto overscroll-contain px-3 py-4 space-y-2 font-mono text-xs"
        >
          <AnimatePresence initial={false}>
            {lines.map((line, i) => (
              <motion.div
                key={`${i}-${line.ts}`}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3 }}
                className="flex items-start gap-2.5 px-2 py-1.5 rounded hover:bg-subtle/50 transition-colors"
              >
                <span className="mt-0.5 shrink-0">{levelGlyph(line.level)}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-[9px] uppercase tracking-widest text-muted/50">
                    <span>{fmtTime(line.ts)}</span>
                    {line.scope && (
                      <span className="px-1.5 py-px bg-subtle rounded-sm text-muted">
                        {line.scope}
                      </span>
                    )}
                  </div>
                  <p className={`mt-0.5 leading-snug break-words ${levelColor(line.level)}`}>
                    {line.message}
                  </p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {lines.length === 0 && (
            <div className="space-y-2 px-2 py-3">
              <div className="shimmer-surface h-3 w-2/3 rounded" />
              <div className="shimmer-surface h-3 w-1/2 rounded" />
              <p className="text-muted/50 text-xs italic pt-2">
                Waiting for the agent to begin…
              </p>
            </div>
          )}

          {!allReady && lines.length > 0 && (
            <div className="flex items-center gap-2 px-2 py-2 mt-1">
              <Loader2 className="w-3 h-3 text-accent animate-spin shrink-0" />
              <span className="shimmer-text text-[11px] font-mono uppercase tracking-widest">
                Synthesizing niches…
              </span>
            </div>
          )}

          <AnimatePresence>
            {allReady && niches.length > 0 && (
              <motion.div
                key="strategy-block"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                className="mt-4 pt-4 border-t border-card-border/80 px-2"
              >
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-3 h-3 text-accent" />
                  <p className="text-[10px] font-mono uppercase tracking-widest text-success">
                    Strategies ready
                  </p>
                </div>

                <ChainOfThought>
                  <ChainOfThoughtStep>
                    <ChainOfThoughtTrigger>
                      Synthesized {niches.length} niche
                      {niches.length === 1 ? "" : "s"} from the live graph
                    </ChainOfThoughtTrigger>
                    <ChainOfThoughtContent>
                      {niches.map((niche) => {
                        const state =
                          rowState[niche] ??
                          ({ status: "ready" } as NicheRowState);
                        const isWorking =
                          state.status === "generating" ||
                          state.status === "pushing";
                        return (
                          <ChainOfThoughtItem key={niche}>
                            <div className="flex items-center gap-2.5">
                              <div className="flex-1 min-w-0">
                                <p className="text-[13px] font-medium text-foreground leading-tight truncate">
                                  {niche}
                                </p>
                                {state.message ? (
                                  <p
                                    className={`text-[10px] font-mono mt-0.5 truncate ${
                                      isWorking ? "shimmer-text" : "text-muted"
                                    }`}
                                  >
                                    {state.message}
                                  </p>
                                ) : (
                                  <p className="text-[10px] font-mono text-muted/60 mt-0.5">
                                    ready to generate
                                  </p>
                                )}
                              </div>
                              <div className="shrink-0">
                                {(state.status === "ready" ||
                                  state.status === "generating") && (
                                  <button
                                    onClick={() => onGenerate(niche)}
                                    disabled={state.status === "generating"}
                                    className="inline-flex items-center gap-1.5 bg-accent hover:bg-accent-hover text-white text-[11px] px-2.5 py-1.5 rounded-md font-medium transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-wait"
                                  >
                                    {state.status === "generating" ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <ArrowRight className="w-3 h-3" />
                                    )}
                                    Generate
                                  </button>
                                )}
                                {(state.status === "designed" ||
                                  state.status === "pushing") && (
                                  <button
                                    onClick={() => onPush(niche)}
                                    disabled={state.status === "pushing"}
                                    className="inline-flex items-center gap-1.5 bg-foreground hover:bg-foreground/90 text-background text-[11px] px-2.5 py-1.5 rounded-md font-medium transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-wait"
                                  >
                                    {state.status === "pushing" ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <Send className="w-3 h-3" />
                                    )}
                                    Push
                                  </button>
                                )}
                                {state.status === "pushed" && (
                                  <span className="inline-flex items-center gap-1.5 text-success text-[11px] px-2.5 py-1.5 font-medium">
                                    <Check className="w-3 h-3" />
                                    Posted
                                  </span>
                                )}
                              </div>
                            </div>
                          </ChainOfThoughtItem>
                        );
                      })}
                    </ChainOfThoughtContent>
                  </ChainOfThoughtStep>
                </ChainOfThought>
              </motion.div>
            )}
          </AnimatePresence>

          <div ref={endRef} />
        </div>
      </div>
    </aside>
  );
}
