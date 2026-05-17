"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Layers, Loader2, ChevronLeft, ChevronRight, RefreshCw, Send, Check } from "lucide-react";
import type { StrategyData } from "@/types";
import { pushToTiktok } from "@/app/actions/push-to-tiktok";
import {
  ensureCarousel,
  readCachedCarousel,
  prewarmCarousel,
  clearCachedCarousel,
} from "@/lib/carousel-prefetch";

type GenerateState = "idle" | "generating" | "done" | "error";

const CAROUSEL_API_BASE =
  process.env.NEXT_PUBLIC_CAROUSEL_API_BASE ?? "http://localhost:8000";

export default function ContentStudio({
  strategy,
  persona,
}: {
  strategy: StrategyData;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  persona?: Record<string, any>;
}) {
  const [genState, setGenState] = useState<GenerateState>("idle");
  const [genLogs, setGenLogs] = useState<string[]>([]);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [activeSlide, setActiveSlide] = useState(0);
  const [count, setCount] = useState(1);
  const [mockNiche, setMockNiche] = useState<string>("");
  const [mockSlides, setMockSlides] = useState<string[]>([]);
  const [pushState, setPushState] = useState<"idle" | "pushing" | "pushed">("idle");

  useEffect(() => {
    const raw = sessionStorage.getItem("brainpost.lastGeneration");
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as { niche: string; contextLog: string[]; mocked: boolean };
        const logs = parsed.contextLog ?? [];
        setGenLogs(logs);
        setMockNiche(parsed.niche ?? "");
        // Extract topics from context log line like: topics: "a" · "b" · "c"
        const topicsLine = logs.find((l) => l.startsWith("topics:"));
        const topics = topicsLine
          ? Array.from(topicsLine.matchAll(/"([^"]+)"/g)).map((m) => m[1])
          : [];
        const slides = [
          parsed.niche,
          ...topics,
          "Save this for later →",
        ].filter(Boolean).slice(0, 6);
        setMockSlides(slides);
        setGenState("done");
        sessionStorage.removeItem("brainpost.lastGeneration");
      } catch {
        // ignore malformed
      }
      return;
    }
    if (!readCachedCarousel(count)) {
      prewarmCarousel({ count, persona: persona ?? {} });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const generateImages = async ({ force }: { force?: boolean } = {}) => {
    if (!force) {
      const cached = readCachedCarousel(count);
      if (cached) {
        setImageUrls(cached.imageUrls);
        setGenLogs(cached.logs);
        setActiveSlide(0);
        setGenState("done");
        return;
      }
    } else {
      clearCachedCarousel(count);
    }

    setGenState("generating");
    setGenLogs([]);
    setImageUrls([]);

    const result = await ensureCarousel({ count, persona: persona ?? {} });
    if (!result) {
      setGenState("error");
      return;
    }
    setImageUrls(result.imageUrls);
    setGenLogs(result.logs);
    setActiveSlide(0);
    setGenState("done");
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <div className="flex items-center justify-between mb-10">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Content Studio</h1>
          <p className="text-sm text-muted mt-1">Review your strategy and generate carousel images.</p>
        </div>
      </div>

      {/* Strategy */}
      <section className="mb-12">
        <h2 className="text-xs text-muted uppercase tracking-widest mb-5 font-medium">Strategy</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <StrategyCard label="Hook Pattern" value={strategy.hookPattern} />
          <StrategyCard label="Structure" value={strategy.slideStructure} />
          <StrategyCard label="CTA Style" value={strategy.ctaStyle} />
        </div>
        <div className="mt-6 flex items-center gap-4">
          <div className="flex-1 h-1 bg-subtle rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-accent rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${strategy.nicheScore}%` }}
              transition={{ duration: 1, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
          <span className="text-xs font-mono text-muted">{strategy.nicheScore}% niche fit</span>
        </div>
      </section>

      {/* Carousel section */}
      <section>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xs text-muted uppercase tracking-widest font-medium">Carousel</h2>
          {genState === "done" && (
            <button
              onClick={() => generateImages({ force: true })}
              className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-foreground transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" /> Regenerate
            </button>
          )}
        </div>

        <AnimatePresence mode="wait">
          {/* Idle — CTA */}
          {genState === "idle" && (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="border border-dashed border-card-border rounded-xl p-16 flex flex-col items-center gap-4"
            >
              <Layers className="w-8 h-8 text-muted/30" />
              <p className="text-sm text-muted text-center">
                How many carousels do you want?
              </p>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => setCount(n)}
                    className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                      count === n
                        ? "bg-accent text-white"
                        : "bg-subtle text-muted hover:text-foreground"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <button
                onClick={() => generateImages()}
                className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer"
              >
                <Layers className="w-3.5 h-3.5" /> Generate {count === 1 ? "Carousel" : `${count} Carousels`}
              </button>
            </motion.div>
          )}

          {/* Generating — progress log */}
          {genState === "generating" && (
            <motion.div
              key="generating"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="border border-card-border rounded-xl p-6"
            >
              <div className="flex items-center gap-3 mb-5">
                <Loader2 className="w-4 h-4 text-accent animate-spin" />
                <span className="text-sm font-medium">Generating carousel…</span>
              </div>
              <div className="font-mono text-xs space-y-1.5 max-h-60 overflow-y-auto">
                {genLogs.map((log, i) => (
                  <div key={i} className="flex gap-2 text-muted/70">
                    <span className="text-accent">›</span>
                    <span>{log}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Done — fallback slide viewer + context log */}
          {genState === "done" && imageUrls.length === 0 && mockSlides.length > 0 && (
            <motion.div
              key="done-mock"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              {/* Slide viewer */}
              <div className="relative flex items-center justify-center mb-4">
                <button
                  onClick={() => setActiveSlide((s) => Math.max(0, s - 1))}
                  disabled={activeSlide === 0}
                  className="absolute left-0 p-2 text-muted hover:text-foreground disabled:opacity-20 transition-colors cursor-pointer z-10"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <AnimatePresence mode="wait">
                  <motion.img
                    key={activeSlide}
                    src={`/mock-slides/slide_${String((activeSlide % FALLBACK_SLIDE_COUNT) + 1).padStart(2, "0")}.jpg`}
                    alt={`Slide ${activeSlide + 1}`}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                    className="w-60 rounded-2xl shadow-2xl flex-shrink-0 object-cover"
                    style={{ aspectRatio: "9/16" }}
                  />
                </AnimatePresence>
                <button
                  onClick={() => setActiveSlide((s) => Math.min(mockSlides.length - 1, s + 1))}
                  disabled={activeSlide === mockSlides.length - 1}
                  className="absolute right-0 p-2 text-muted hover:text-foreground disabled:opacity-20 transition-colors cursor-pointer z-10"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              {/* Thumbnail strip */}
              <div className="flex gap-2 justify-center overflow-x-auto pb-2 mb-6">
                {mockSlides.map((_, i) => (
                  <button key={i} onClick={() => setActiveSlide(i)} className="cursor-pointer flex-shrink-0">
                    <img
                      src={`/mock-slides/slide_${String((i % FALLBACK_SLIDE_COUNT) + 1).padStart(2, "0")}.jpg`}
                      alt={`Slide ${i + 1}`}
                      className={`w-10 h-16 rounded-md object-cover transition-all ${
                        i === activeSlide ? "ring-2 ring-accent scale-105 shadow-lg" : "opacity-50 hover:opacity-80"
                      }`}
                    />
                  </button>
                ))}
              </div>
              <p className="text-center text-xs text-muted mb-8">
                Slide {activeSlide + 1} of {mockSlides.length}
              </p>

              {/* Context log */}
              <div className="border-t border-card-border pt-6">
                <p className="text-[10px] font-mono uppercase tracking-widest text-muted mb-3">
                  GBrain context
                </p>
                <div className="font-mono text-xs space-y-1 max-h-40 overflow-y-auto">
                  {genLogs.map((log, i) => {
                    const [key, ...rest] = log.split(": ");
                    return (
                      <div key={i} className="flex gap-2 text-muted/60">
                        <span className="text-accent shrink-0">›</span>
                        <span>
                          <span className="text-muted/50">{key}:</span>{" "}
                          {rest.join(": ")}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Post to TikTok */}
              <div className="mt-6 flex justify-center">
                <button
                  onClick={async () => {
                    setPushState("pushing");
                    try {
                      await pushToTiktok({
                        nicheSlug: mockNiche || "brainpost",
                        integrationId: "cmp91zvg701rfoh0ymuqq4tpg",
                      });
                      setPushState("pushed");
                    } catch {
                      setPushState("idle");
                    }
                  }}
                  disabled={pushState === "pushing" || pushState === "pushed"}
                  className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {pushState === "pushing" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : pushState === "pushed" ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  {pushState === "pushed" ? "Scheduled!" : pushState === "pushing" ? "Scheduling…" : "Post to TikTok"}
                </button>
              </div>
            </motion.div>
          )}

          {/* Done — image viewer */}
          {genState === "done" && imageUrls.length > 0 && (
            <motion.div
              key="done"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              {/* Main slide */}
              <div className="relative flex items-center justify-center mb-4">
                <button
                  onClick={() => setActiveSlide((s) => Math.max(0, s - 1))}
                  disabled={activeSlide === 0}
                  className="absolute left-0 p-2 text-muted hover:text-foreground disabled:opacity-20 transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <motion.img
                  key={activeSlide}
                  src={`${CAROUSEL_API_BASE}${imageUrls[activeSlide]}`}
                  alt={`Slide ${activeSlide + 1}`}
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.2 }}
                  className="w-72 rounded-xl shadow-xl"
                />
                <button
                  onClick={() => setActiveSlide((s) => Math.min(imageUrls.length - 1, s + 1))}
                  disabled={activeSlide === imageUrls.length - 1}
                  className="absolute right-0 p-2 text-muted hover:text-foreground disabled:opacity-20 transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              {/* Thumbnail strip */}
              <div className="flex gap-2 justify-center overflow-x-auto pb-2">
                {imageUrls.map((url, i) => (
                  <button key={i} onClick={() => setActiveSlide(i)} className="cursor-pointer flex-shrink-0">
                    <img
                      src={`${CAROUSEL_API_BASE}${url}`}
                      alt={`Slide ${i + 1}`}
                      className={`w-14 rounded-md transition-all ${
                        i === activeSlide ? "ring-2 ring-accent" : "opacity-40 hover:opacity-70"
                      }`}
                    />
                  </button>
                ))}
              </div>

              <p className="text-center text-xs text-muted mt-3">
                Slide {activeSlide + 1} of {imageUrls.length}
              </p>
            </motion.div>
          )}

          {/* Error */}
          {genState === "error" && (
            <motion.div
              key="error"
              className="border border-dashed border-card-border rounded-xl p-12 flex flex-col items-center gap-4"
            >
              <p className="text-sm text-red-400">Generation failed. Check the backend logs.</p>
              <button
                onClick={() => generateImages()}
                className="text-sm text-muted hover:text-foreground transition-colors cursor-pointer"
              >
                Try again
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

    </div>
  );
}

function StrategyCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card-bg border border-card-border rounded-xl p-4">
      <p className="text-[10px] text-muted/60 uppercase tracking-widest mb-2">{label}</p>
      <p className="text-sm text-foreground/80 leading-relaxed">{value}</p>
    </div>
  );
}

const FALLBACK_SLIDE_COUNT = 6;
