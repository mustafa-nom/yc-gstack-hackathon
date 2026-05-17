"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { ArrowRight, Zap, Loader2 } from "lucide-react";
import { startOnboarding } from "@/app/actions/onboard";
import type { GraphEvent } from "@/lib/graph-bus";
import { setStoredRunId } from "@/lib/run-context";

// Mount the live graph as a full-viewport background during scanning so it's
// already populated by the time the user clicks through to /graph. Next route
// transitions unmount the previous page, so this never coexists with the
// /graph instance — no duplicate WebGL contexts.
const LiveGraph = dynamic(
  () => import("@/components/LiveGraph").then((m) => m.LiveGraph),
  { ssr: false },
);

const STEP_ORDER = [
  "welcome",
  "website",
  "description",
  "tiktok",
  "scanning",
] as const;

type Step = (typeof STEP_ORDER)[number];

export default function OnboardingFlow() {
  const [step, setStep] = useState<Step>("welcome");
  const [website, setWebsite] = useState("");
  const [description, setDescription] = useState("");
  const [tiktok, setTiktok] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [runId, setRunId] = useState<string | null>(null);
  const [logLines, setLogLines] = useState<{ text: string; level: "info" | "success" | "warn" | "error" }[]>([]);
  const [currentTyping, setCurrentTyping] = useState("");
  const [allReady, setAllReady] = useState(false);
  const [readyNiches, setReadyNiches] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const logEndRef = useRef<HTMLDivElement>(null);
  const typeQueueRef = useRef<{ text: string; level: "info" | "success" | "warn" | "error" }[]>([]);
  const typingRef = useRef(false);
  const router = useRouter();
  // useState lazy initializer runs exactly once at mount — keeps the impure
  // Date.now / Math.random out of render and satisfies react-hooks/purity.
  const [uiSessionId] = useState(
    () => `ui-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
  );

  useEffect(() => {
    const logId = runId ?? uiSessionId;
    void fetch("/api/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        runId: logId,
        step: `ui:${step}`,
        level: "info",
        message: `entered step "${step}"`,
      }),
    }).catch(() => {});
  }, [step, runId]);

  useEffect(() => {
    if (!runId) return;
    void fetch("/api/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        runId,
        step: "ui:linked",
        level: "info",
        message: `ui session ${uiSessionId} linked to run ${runId}`,
      }),
    }).catch(() => {});
  }, [runId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (step === "description") textareaRef.current?.focus();
      else inputRef.current?.focus();
    }, 400);
    return () => clearTimeout(timer);
  }, [step]);

  const drainRef = useRef<() => void>(() => {});
  const drainTypeQueue = useCallback(() => {
    if (typingRef.current) return;
    const next = typeQueueRef.current.shift();
    if (!next) return;
    typingRef.current = true;
    const { text, level } = next;
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setCurrentTyping(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(interval);
        setCurrentTyping("");
        setLogLines((prev) => [...prev, { text, level }]);
        typingRef.current = false;
        setTimeout(() => drainRef.current(), 80);
      }
    }, 14);
  }, []);
  useEffect(() => {
    drainRef.current = drainTypeQueue;
  }, [drainTypeQueue]);

  const launch = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const result = await startOnboarding({
        website,
        description,
        referenceTiktok: tiktok,
      });
      setRunId(result.runId);
      setStoredRunId(result.runId);
      setStep("scanning");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[onboarding] launch failed:", msg);
      setSubmitting(false);
    }
  }, [submitting, website, description, tiktok]);

  useEffect(() => {
    if (step !== "scanning" || !runId) return;
    const es = new EventSource(`/api/graph/stream?runId=${encodeURIComponent(runId)}`);
    es.onmessage = (e) => {
      let event: GraphEvent;
      try {
        event = JSON.parse(e.data) as GraphEvent;
      } catch {
        return;
      }
      if (event.kind === "log") {
        typeQueueRef.current.push({ text: event.message, level: event.level });
        drainTypeQueue();
      } else if (event.kind === "nicheReady") {
        typeQueueRef.current.push({
          text: `niche ready: ${event.niche}`,
          level: "success",
        });
        setReadyNiches((n) => n + 1);
        drainTypeQueue();
      } else if (event.kind === "allReady") {
        typeQueueRef.current.push({
          text: "all niches ready — graph fully synthesized",
          level: "success",
        });
        setAllReady(true);
        drainTypeQueue();
      } else if (event.kind === "error") {
        typeQueueRef.current.push({
          text: event.message,
          level: "error",
        });
        drainTypeQueue();
      }
    };
    es.onerror = () => {
      // EventSource auto-reconnects; nothing to do
    };
    return () => es.close();
  }, [step, runId, drainTypeQueue]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logLines, currentTyping]);

  const handleKeyDown = (e: React.KeyboardEvent, onEnter: () => void, onTab?: () => void) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onEnter(); }
    if (e.key === "Tab") { e.preventDefault(); (onTab ?? onEnter)(); }
  };

  const goNext = (from: Step) => {
    const i = STEP_ORDER.indexOf(from);
    if (i < STEP_ORDER.length - 1) setStep(STEP_ORDER[i + 1]);
  };

  const goBack = (from: Step) => {
    const i = STEP_ORDER.indexOf(from);
    if (i > 0) setStep(STEP_ORDER[i - 1]);
  };

  const stepIndex = STEP_ORDER.indexOf(step);
  const inputSteps = STEP_ORDER.filter((s) => s !== "welcome" && s !== "scanning");
  const inputStepNum = inputSteps.indexOf(step as (typeof inputSteps)[number]) + 1;
  const showProgress = step !== "welcome" && step !== "scanning";

  const motionProps = {
    initial: { opacity: 0, y: 20 } as const,
    animate: { opacity: 1, y: 0 } as const,
    exit: { opacity: 0, y: -20 } as const,
    transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } as const,
  };

  return (
    <div className="min-h-screen flex flex-col relative">
      {step === "scanning" && runId && (
        <div className="fixed inset-0 z-0">
          <LiveGraph runId={runId} />
        </div>
      )}
      {showProgress && (
        <div className="fixed top-0 left-0 right-0 h-[2px] bg-subtle z-50">
          <motion.div
            className="h-full bg-accent"
            initial={{ width: "0%" }}
            animate={{ width: `${(stepIndex / (STEP_ORDER.length - 1)) * 100}%` }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>
      )}

      <div className="flex-1 flex items-center justify-center px-6 relative z-10">
        <AnimatePresence mode="wait">
          {step === "welcome" && (
            <motion.div key="welcome" {...motionProps} className="text-center max-w-md">
              <div className="inline-flex items-center gap-2.5 mb-8">
                <Zap className="w-6 h-6 text-accent" />
                <span className="text-xl font-semibold tracking-tight">BrainPost</span>
              </div>
              <h1 className="text-3xl font-semibold tracking-tight mb-3">
                Build your content strategy
              </h1>
              <p className="text-muted text-base mb-10 leading-relaxed">
                Answer a few quick questions and our agent will research your niches live on
                TikTok, then build an optimized content plan.
              </p>
              <button
                onClick={() => goNext("welcome")}
                className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-white px-6 py-3 rounded-lg text-sm font-medium transition-colors cursor-pointer"
              >
                Get Started
                <ArrowRight className="w-4 h-4" />
              </button>
            </motion.div>
          )}

          {step === "website" && (
            <motion.div key="website" {...motionProps} className="w-full max-w-lg">
              <p className="text-sm text-muted mb-2 font-mono">
                {String(inputStepNum).padStart(2, "0")}
              </p>
              <h2 className="text-2xl font-semibold tracking-tight mb-2">
                What&apos;s your product website?
              </h2>
              <p className="text-muted text-sm mb-8">
                We&apos;ll crawl it to understand your brand and offering.
              </p>
              <input
                ref={inputRef}
                type="url"
                placeholder="https://yourproduct.com"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, () => website.trim() && goNext("website"))}
                className="w-full bg-transparent border-b border-card-border py-3 text-lg text-foreground placeholder:text-muted/40 focus:outline-none focus:border-accent transition-colors"
              />
              <StepNav
                onBack={null}
                onNext={() => website.trim() && goNext("website")}
                nextDisabled={!website.trim()}
              />
            </motion.div>
          )}

          {step === "description" && (
            <motion.div key="description" {...motionProps} className="w-full max-w-lg">
              <p className="text-sm text-muted mb-2 font-mono">
                {String(inputStepNum).padStart(2, "0")}
              </p>
              <h2 className="text-2xl font-semibold tracking-tight mb-2">
                Describe your product
              </h2>
              <p className="text-muted text-sm mb-8">
                A short description — what it does and who it&apos;s for.
              </p>
              <textarea
                ref={textareaRef}
                placeholder="e.g. A budgeting app that helps Gen-Z save money through automated micro-investing"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onKeyDown={(e) =>
                  handleKeyDown(
                    e,
                    () => description.trim() && goNext("description"),
                    () => goNext("description"),
                  )
                }
                rows={2}
                className="w-full bg-transparent border-b border-card-border py-3 text-lg text-foreground placeholder:text-muted/40 focus:outline-none focus:border-accent transition-colors resize-none"
              />
              <StepNav
                onBack={() => goBack("description")}
                onNext={() => description.trim() && goNext("description")}
                nextDisabled={!description.trim()}
                onSkip={() => goNext("description")}
              />
            </motion.div>
          )}

          {step === "tiktok" && (
            <motion.div key="tiktok" {...motionProps} className="w-full max-w-lg">
              <p className="text-sm text-muted mb-2 font-mono">
                {String(inputStepNum).padStart(2, "0")}
              </p>
              <h2 className="text-2xl font-semibold tracking-tight mb-2">
                Drop a reference TikTok
              </h2>
              <p className="text-muted text-sm mb-8">
                A TikTok URL that captures the style or energy you&apos;re going for.
              </p>
              <input
                ref={inputRef}
                type="url"
                placeholder="https://tiktok.com/@creator/video/..."
                value={tiktok}
                onChange={(e) => setTiktok(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, () => launch(), () => launch())}
                className="w-full bg-transparent border-b border-card-border py-3 text-lg text-foreground placeholder:text-muted/40 focus:outline-none focus:border-accent transition-colors"
              />
              <div className="flex items-center justify-between mt-8">
                <button
                  onClick={() => goBack("tiktok")}
                  className="text-sm text-muted hover:text-foreground transition-colors cursor-pointer"
                  disabled={submitting}
                >
                  Back
                </button>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => launch()}
                    className="text-sm text-muted hover:text-foreground transition-colors cursor-pointer disabled:opacity-50"
                    disabled={submitting}
                  >
                    Skip
                  </button>
                  <button
                    onClick={() => launch()}
                    disabled={submitting}
                    className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer disabled:cursor-wait"
                  >
                    {submitting ? "Launching…" : "Launch agents"}
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {step === "scanning" && (
            <motion.div
              key="scanning"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="w-full max-w-xl"
            >
              <div className="flex items-center gap-2 mb-6">
                {!allReady ? (
                  <Loader2 className="w-4 h-4 text-accent animate-spin" />
                ) : (
                  <div className="w-2 h-2 rounded-full bg-success" />
                )}
                <h2 className="text-xs font-mono uppercase tracking-[0.18em] text-muted">
                  {allReady ? "GRAPH READY" : "ANALYZING NICHES"}
                </h2>
                {readyNiches > 0 && (
                  <span className="text-[10px] font-mono uppercase tracking-widest text-muted/60 ml-auto">
                    {readyNiches} niche{readyNiches === 1 ? "" : "s"} ready
                  </span>
                )}
              </div>

              <div className="bg-card-bg/50 border border-card-border rounded-md px-5 py-4 h-[320px] overflow-y-auto font-mono text-[12px] leading-relaxed space-y-1.5">
                {logLines.map((line, i) => {
                  const color =
                    line.level === "success"
                      ? "text-success"
                      : line.level === "warn"
                        ? "text-accent"
                        : line.level === "error"
                          ? "text-danger"
                          : "text-foreground/70";
                  const glyph =
                    line.level === "success"
                      ? "✓"
                      : line.level === "error"
                        ? "✗"
                        : "›";
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.2 }}
                      className="flex items-start gap-2"
                    >
                      <span className={color}>{glyph}</span>
                      <span className={color}>{line.text}</span>
                    </motion.div>
                  );
                })}
                {currentTyping && (
                  <div className="flex items-start gap-2">
                    <span className="text-accent">›</span>
                    <span className="text-foreground/70">{currentTyping}</span>
                  </div>
                )}
                <div ref={logEndRef} />
              </div>

              <div className="mt-6 flex items-center justify-between">
                <p className="text-xs text-muted/60">
                  {allReady
                    ? "Strategy synthesized across all niches."
                    : "Our agents are scanning hooks, creators, and patterns on TikTok."}
                </p>
                <button
                  onClick={() =>
                    runId && router.push(`/graph?runId=${encodeURIComponent(runId)}`)
                  }
                  disabled={!allReady && readyNiches === 0}
                  className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover disabled:opacity-30 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer disabled:cursor-not-allowed"
                >
                  View live graph
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function StepNav({
  onBack,
  onNext,
  nextDisabled,
  onSkip,
}: {
  onBack: (() => void) | null;
  onNext: () => void;
  nextDisabled: boolean;
  onSkip?: () => void;
}) {
  return (
    <div className="flex items-center justify-between mt-8">
      {onBack ? (
        <button
          onClick={onBack}
          className="text-sm text-muted hover:text-foreground transition-colors cursor-pointer"
        >
          Back
        </button>
      ) : (
        <p className="text-xs text-muted/60">
          Press{" "}
          <kbd className="px-1.5 py-0.5 bg-subtle rounded text-muted text-[11px]">Enter</kbd>{" "}
          to continue
        </p>
      )}
      <div className="flex items-center gap-3">
        {onSkip && (
          <button
            onClick={onSkip}
            className="text-sm text-muted hover:text-foreground transition-colors cursor-pointer"
          >
            Skip
          </button>
        )}
        <button
          onClick={onNext}
          disabled={nextDisabled}
          className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover disabled:opacity-30 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer disabled:cursor-not-allowed"
        >
          Next
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
