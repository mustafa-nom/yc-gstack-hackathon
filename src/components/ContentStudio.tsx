"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { RefreshCw, ExternalLink } from "lucide-react";
import type { StrategyData, SlideData } from "@/types";

export default function ContentStudio({
  strategy,
  slides,
}: {
  strategy: StrategyData;
  slides: SlideData[];
}) {
  const [approval, setApproval] = useState<"pending" | "approved">("pending");

  return (
    <div>
      <div className="flex items-center justify-between mb-10">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Content Studio
          </h1>
          <p className="text-sm text-muted mt-1">
            Review your generated strategy and carousel.
          </p>
        </div>
        <button
          onClick={() =>
            setApproval((s) => (s === "pending" ? "approved" : "pending"))
          }
          className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
            approval === "approved"
              ? "bg-success/10 text-success"
              : "bg-accent/10 text-accent"
          }`}
        >
          {approval === "pending" ? "Pending" : "Approved"}
        </button>
      </div>

      <section className="mb-12">
        <h2 className="text-xs text-muted uppercase tracking-widest mb-5 font-medium">
          Strategy
        </h2>
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
          <span className="text-xs font-mono text-muted">
            {strategy.nicheScore}% niche fit
          </span>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xs text-muted uppercase tracking-widest font-medium">
            Carousel — {slides.length} Slides
          </h2>
          <div className="flex gap-2">
            <button className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-foreground transition-colors cursor-pointer">
              <RefreshCw className="w-3 h-3" />
              Regenerate
            </button>
            <button className="inline-flex items-center gap-1.5 text-xs text-accent hover:text-accent-hover transition-colors cursor-pointer">
              <ExternalLink className="w-3 h-3" />
              Export
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {slides.map((slide, i) => (
            <motion.div
              key={slide.number}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.4,
                delay: i * 0.06,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="bg-card-bg border border-card-border rounded-xl p-5 flex flex-col"
            >
              <span className="text-[10px] text-muted/50 font-mono mb-3">
                {String(slide.number).padStart(2, "0")}
              </span>
              <h3 className="text-sm font-semibold mb-2 leading-snug">
                {slide.headline}
              </h3>
              <p className="text-xs text-muted leading-relaxed">
                {slide.body}
              </p>
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
      <p className="text-[10px] text-muted/60 uppercase tracking-widest mb-2">
        {label}
      </p>
      <p className="text-sm text-foreground/80 leading-relaxed">{value}</p>
    </div>
  );
}
