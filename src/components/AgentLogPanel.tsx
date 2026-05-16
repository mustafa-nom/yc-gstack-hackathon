"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Loader2, Sparkles, CircleAlert, CircleCheck, ArrowUp } from "lucide-react";
import type { GraphEvent } from "@/lib/graph-bus";

type LogLine = {
  ts: string;
  level: "info" | "success" | "warn" | "error";
  message: string;
  scope?: string;
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
}: {
  runId: string;
  allReady: boolean;
}) {
  const [lines, setLines] = useState<LogLine[]>([]);
  const [ask, setAsk] = useState("");
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
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [lines.length]);

  return (
    <aside className="fixed top-0 bottom-0 left-0 z-20 w-full sm:w-[380px] flex flex-col">
      <div className="h-full flex flex-col bg-card-bg/85 border-r border-card-border backdrop-blur-md">
        <header className="px-5 py-4 border-b border-card-border flex items-center gap-2">
          <div
            className={`w-1.5 h-1.5 rounded-full ${
              allReady ? "bg-success" : "bg-accent animate-pulse"
            }`}
          />
          <p className="text-[10px] font-mono uppercase tracking-widest text-muted">
            agent log
          </p>
          <p className="text-[10px] font-mono text-muted/60 ml-auto">
            run · {runId.slice(-8)}
          </p>
        </header>

        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-2 font-mono text-xs">
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
            <div className="text-muted/50 text-xs px-2 py-3 italic">
              Waiting for the agent to begin…
            </div>
          )}
          <div ref={endRef} />
        </div>

        <footer className="px-3 py-3 border-t border-card-border">
          <div className="flex items-center gap-2 bg-subtle/60 border border-card-border rounded-lg px-3 py-2">
            <input
              type="text"
              placeholder="Ask anything about your data…"
              value={ask}
              onChange={(e) => setAsk(e.target.value)}
              disabled
              className="flex-1 bg-transparent text-xs placeholder:text-muted/50 focus:outline-none disabled:cursor-not-allowed"
            />
            <button
              disabled
              className="text-muted/40 cursor-not-allowed"
              aria-label="Send"
            >
              <ArrowUp className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-[9px] text-muted/40 mt-1.5 px-1 font-mono uppercase tracking-widest">
            chat · coming soon
          </p>
        </footer>
      </div>
    </aside>
  );
}
