"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Layers, Loader2, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import type { StrategyData } from "@/types";

type GenerateState = "idle" | "generating" | "done" | "error";

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

  const generateImages = async () => {
    setGenState("generating");
    setGenLogs([]);
    setImageUrls([]);

    const response = await fetch("http://localhost:8000/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ persona: persona ?? {}, count, skip_images: false }),
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
              onClick={generateImages}
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
                onClick={generateImages}
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
                  src={`http://localhost:8000${imageUrls[activeSlide]}`}
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
                      src={`http://localhost:8000${url}`}
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
                onClick={generateImages}
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
