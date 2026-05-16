"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { RefreshCw, ImageIcon, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import type { StrategyData, SlideData } from "@/types";

type GenerateState = "idle" | "generating" | "done" | "error";

export default function ContentStudio({
  strategy,
  slides,
  persona,
}: {
  strategy: StrategyData;
  slides: SlideData[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  persona: Record<string, any>;
}) {
  const [genState, setGenState] = useState<GenerateState>("idle");
  const [genLogs, setGenLogs] = useState<string[]>([]);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [activeSlide, setActiveSlide] = useState(0);

  const generateImages = async () => {
    setGenState("generating");
    setGenLogs([]);
    setImageUrls([]);

    const response = await fetch("http://localhost:8000/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ persona, count: 1, skip_images: false }),
    });

    if (!response.body) { setGenState("error"); return; }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";
      for (const part of parts) {
        const line = part.trim();
        if (!line.startsWith("data:")) continue;
        try {
          const event = JSON.parse(line.slice(5).trim());
          if (event.type === "log" && event.message?.trim()) {
            setGenLogs((prev) => [...prev, event.message]);
          } else if (event.type === "done") {
            setImageUrls(event.imageUrls ?? []);
            setActiveSlide(0);
            setGenState("done");
          } else if (event.type === "error") {
            setGenState("error");
          }
        } catch { continue; }
      }
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-10">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Content Studio</h1>
          <p className="text-sm text-muted mt-1">Review your generated strategy and carousel.</p>
        </div>
        <button
          onClick={generateImages}
          disabled={genState === "generating"}
          className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer disabled:cursor-not-allowed"
        >
          {genState === "generating" ? (
            <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating…</>
          ) : (
            <><ImageIcon className="w-3.5 h-3.5" /> Generate Images</>
          )}
        </button>
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

      {/* Generation progress */}
      <AnimatePresence>
        {genState === "generating" && genLogs.length > 0 && (
          <motion.section
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-10 overflow-hidden"
          >
            <div className="bg-card-bg border border-card-border rounded-xl p-5 font-mono text-xs space-y-1.5 max-h-48 overflow-y-auto">
              {genLogs.map((log, i) => (
                <div key={i} className="text-muted/70 flex gap-2">
                  <span className="text-accent">›</span>
                  <span>{log}</span>
                </div>
              ))}
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* Generated image viewer */}
      <AnimatePresence>
        {genState === "done" && imageUrls.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-12"
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xs text-muted uppercase tracking-widest font-medium">
                Generated Carousel — {imageUrls.length} Slides
              </h2>
              <button
                onClick={generateImages}
                className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-foreground transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" /> Regenerate
              </button>
            </div>

            {/* Main slide viewer */}
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
                src={`http://localhost:8000${imageUrls[activeSlide]}`}
                alt={`Slide ${activeSlide + 1}`}
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.25 }}
                className="w-64 rounded-xl shadow-xl"
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
                    src={`http://localhost:8000${url}`}
                    alt={`Slide ${i + 1}`}
                    className={`w-14 rounded-md transition-all ${
                      i === activeSlide ? "ring-2 ring-accent" : "opacity-50 hover:opacity-80"
                    }`}
                  />
                </button>
              ))}
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {genState === "error" && (
        <p className="text-sm text-red-400 mb-8">Image generation failed. Check the backend logs.</p>
      )}

      {/* Slide text cards */}
      <section>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xs text-muted uppercase tracking-widest font-medium">
            Carousel — {slides.length} Slides
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {slides.map((slide, i) => (
            <motion.div
              key={slide.number}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
              className="bg-card-bg border border-card-border rounded-xl p-5 flex flex-col"
            >
              <span className="text-[10px] text-muted/50 font-mono mb-3">
                {String(slide.number).padStart(2, "0")}
              </span>
              <h3 className="text-sm font-semibold mb-2 leading-snug">{slide.headline}</h3>
              <p className="text-xs text-muted leading-relaxed">{slide.body}</p>
            </motion.div>
          ))}
        </div>
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
