"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Loader2, ArrowRight, Zap, Download } from "lucide-react";

const STEP_ORDER = [
  "welcome",
  "website",
  "description",
  "audience",
  "tiktok",
  "scanning",
] as const;

type Step = (typeof STEP_ORDER)[number];

const AGENT_STEPS = [
  "Initializing agent pipeline…",
  "Crawling product website…",
  "Analyzing brand positioning…",
  "Fetching trending videos via Apify…",
  "Extracting hook patterns from high-performers…",
  "Identifying slide structure templates…",
  "Scoring CTA effectiveness across samples…",
  "Analyzing reference TikTok content…",
  "Building audience engagement model…",
  "Writing strategy context to GBrain memory…",
  "Generating personal.md profile…",
  "Selecting optimal carousel template…",
  "Pipeline complete — strategy ready.",
];

function buildPersonalMd(data: {
  website: string;
  description: string;
  audience: string;
  tiktok: string;
}) {
  return [
    `# Personal Profile`,
    ``,
    `## Product`,
    `- **Website:** ${data.website}`,
    `- **Description:** ${data.description}`,
    ``,
    `## Content Strategy`,
    `- **Target Audience:** ${data.audience}`,
    `- **Reference TikTok:** ${data.tiktok}`,
    ``,
  ].join("\n");
}

export default function OnboardingFlow({
  onComplete,
}: {
  onComplete: () => void;
}) {
  const [step, setStep] = useState<Step>("welcome");
  const [website, setWebsite] = useState("");
  const [description, setDescription] = useState("");
  const [audience, setAudience] = useState("");
  const [tiktok, setTiktok] = useState("");
  const [logLines, setLogLines] = useState<string[]>([]);
  const [currentTyping, setCurrentTyping] = useState("");
  const [scanDone, setScanDone] = useState(false);
  const [personalMd, setPersonalMd] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (step === "description") textareaRef.current?.focus();
      else inputRef.current?.focus();
    }, 400);
    return () => clearTimeout(timer);
  }, [step]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logLines, currentTyping]);

  const typewriterLine = useCallback(
    (text: string): Promise<void> =>
      new Promise((resolve) => {
        let i = 0;
        const interval = setInterval(() => {
          i++;
          setCurrentTyping(text.slice(0, i));
          if (i >= text.length) {
            clearInterval(interval);
            setCurrentTyping("");
            setLogLines((prev) => [...prev, text]);
            resolve();
          }
        }, 20);
      }),
    []
  );

  const runScan = useCallback(async () => {
    setStep("scanning");
    setLogLines([]);
    setCurrentTyping("");

    const md = buildPersonalMd({ website, description, audience, tiktok });
    setPersonalMd(md);

    for (const line of AGENT_STEPS) {
      await typewriterLine(line);
      await new Promise((r) => setTimeout(r, 350));
    }

    setScanDone(true);
  }, [typewriterLine, website, description, audience, tiktok]);

  const downloadPersonalMd = () => {
    const blob = new Blob([personalMd], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "personal.md";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleKeyDown = (e: React.KeyboardEvent, action: () => void) => {
    if (e.key === "Enter" && !e.shiftKey) action();
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
    <div className="min-h-screen flex flex-col">
      {showProgress && (
        <div className="fixed top-0 left-0 right-0 h-[2px] bg-subtle z-50">
          <motion.div
            className="h-full bg-accent"
            initial={{ width: "0%" }}
            animate={{
              width: `${(stepIndex / (STEP_ORDER.length - 1)) * 100}%`,
            }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>
      )}

      <div className="flex-1 flex items-center justify-center px-6">
        <AnimatePresence mode="wait">
          {step === "welcome" && (
            <motion.div key="welcome" {...motionProps} className="text-center max-w-md">
              <div className="inline-flex items-center gap-2.5 mb-8">
                <Zap className="w-6 h-6 text-accent" />
                <span className="text-xl font-semibold tracking-tight">
                  BrainPost
                </span>
              </div>
              <h1 className="text-3xl font-semibold tracking-tight mb-3">
                Build your content strategy
              </h1>
              <p className="text-muted text-base mb-10 leading-relaxed">
                Answer a few quick questions and our AI agent will analyze your
                product and build an optimized content plan.
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
                onKeyDown={(e) =>
                  handleKeyDown(e, () => website.trim() && goNext("website"))
                }
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
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (description.trim()) goNext("description");
                  }
                }}
                rows={3}
                className="w-full bg-transparent border-b border-card-border py-3 text-lg text-foreground placeholder:text-muted/40 focus:outline-none focus:border-accent transition-colors resize-none"
              />
              <StepNav
                onBack={() => goBack("description")}
                onNext={() => description.trim() && goNext("description")}
                nextDisabled={!description.trim()}
              />
            </motion.div>
          )}

          {step === "audience" && (
            <motion.div key="audience" {...motionProps} className="w-full max-w-lg">
              <p className="text-sm text-muted mb-2 font-mono">
                {String(inputStepNum).padStart(2, "0")}
              </p>
              <h2 className="text-2xl font-semibold tracking-tight mb-2">
                Who&apos;s your target audience?
              </h2>
              <p className="text-muted text-sm mb-8">
                Describe the people you want to reach.
              </p>
              <input
                ref={inputRef}
                type="text"
                placeholder="e.g. Gen-Z beginners looking to save money"
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                onKeyDown={(e) =>
                  handleKeyDown(e, () => audience.trim() && goNext("audience"))
                }
                className="w-full bg-transparent border-b border-card-border py-3 text-lg text-foreground placeholder:text-muted/40 focus:outline-none focus:border-accent transition-colors"
              />
              <StepNav
                onBack={() => goBack("audience")}
                onNext={() => audience.trim() && goNext("audience")}
                nextDisabled={!audience.trim()}
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
                onKeyDown={(e) =>
                  handleKeyDown(e, () => tiktok.trim() && runScan())
                }
                className="w-full bg-transparent border-b border-card-border py-3 text-lg text-foreground placeholder:text-muted/40 focus:outline-none focus:border-accent transition-colors"
              />
              <div className="flex items-center justify-between mt-8">
                <button
                  onClick={() => goBack("tiktok")}
                  className="text-sm text-muted hover:text-foreground transition-colors cursor-pointer"
                >
                  Back
                </button>
                <button
                  onClick={() => tiktok.trim() && runScan()}
                  disabled={!tiktok.trim()}
                  className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover disabled:opacity-30 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer disabled:cursor-not-allowed"
                >
                  Analyze
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          )}

          {step === "scanning" && (
            <motion.div
              key="scanning"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6 }}
              className="w-full max-w-xl"
            >
              <div className="flex items-center gap-3 mb-8">
                {!scanDone && (
                  <Loader2 className="w-4 h-4 text-accent animate-spin" />
                )}
                <h2 className="text-xl font-semibold tracking-tight">
                  {scanDone ? "Strategy ready" : "Analyzing your product…"}
                </h2>
              </div>

              <div className="space-y-2 font-mono text-sm max-h-[60vh] overflow-y-auto pr-2">
                {logLines.map((line, i) => {
                  const isLast = line.includes("complete");
                  const isPersonal = line.includes("personal.md");
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3 }}
                      className="flex items-start gap-3"
                    >
                      <span
                        className={
                          isLast
                            ? "text-success"
                            : isPersonal
                              ? "text-accent"
                              : "text-muted/50"
                        }
                      >
                        {isLast ? "✓" : isPersonal ? "+" : "›"}
                      </span>
                      <span
                        className={
                          isLast
                            ? "text-success"
                            : isPersonal
                              ? "text-accent"
                              : "text-foreground/60"
                        }
                      >
                        {line}
                      </span>
                    </motion.div>
                  );
                })}
                {currentTyping && (
                  <div className="flex items-start gap-3">
                    <span className="text-accent">›</span>
                    <span className="text-foreground/60 cursor-blink">
                      {currentTyping}
                    </span>
                  </div>
                )}
                <div ref={logEndRef} />
              </div>

              {scanDone && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.3 }}
                  className="mt-10 flex items-center gap-3"
                >
                  <button
                    onClick={onComplete}
                    className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-white px-6 py-3 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                  >
                    View Strategy
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={downloadPersonalMd}
                    className="inline-flex items-center gap-2 text-muted hover:text-foreground px-4 py-3 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    personal.md
                  </button>
                </motion.div>
              )}
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
}: {
  onBack: (() => void) | null;
  onNext: () => void;
  nextDisabled: boolean;
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
          <kbd className="px-1.5 py-0.5 bg-subtle rounded text-muted text-[11px]">
            Enter
          </kbd>{" "}
          to continue
        </p>
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
  );
}
