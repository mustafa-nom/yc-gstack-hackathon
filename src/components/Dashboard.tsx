"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import ContentStudio from "./ContentStudio";
import PerformanceLoop from "./PerformanceLoop";
import { KnowledgeGraph } from "./KnowledgeGraph";
import type { ScanResult } from "@/types";

type Tab = "studio" | "performance";

export default function Dashboard({ scanResult }: { scanResult: ScanResult }) {
  const [tab, setTab] = useState<Tab>("studio");

  return (
    <div className="min-h-screen flex flex-col relative">
      <div className="opacity-30 pointer-events-none">
        <KnowledgeGraph visible={tab === "studio"} />
      </div>
      <header className="border-b border-card-border">
        <div className="max-w-4xl mx-auto px-6 flex items-center justify-between h-14">
          <span className="text-sm font-semibold tracking-tight text-foreground/80">
            BrainPost
          </span>
          <nav className="flex gap-1">
            {(["studio", "performance"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-1.5 rounded-md text-sm transition-colors cursor-pointer ${
                  tab === t
                    ? "text-foreground bg-subtle"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {t === "studio" ? "Content" : "Performance"}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <div className="max-w-4xl mx-auto px-6 py-12">
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            >
              {tab === "studio" && <ContentStudio strategy={scanResult.strategy} slides={scanResult.slides} />}
              {tab === "performance" && <PerformanceLoop />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
