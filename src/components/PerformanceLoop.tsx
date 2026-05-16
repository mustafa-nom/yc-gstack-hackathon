"use client";

import { motion } from "motion/react";

const POSTS = [
  { date: "May 14", niche: "Finance", hook: "Stop Saving Money", predicted: 85, actual: 124000, delta: 46 },
  { date: "May 11", niche: "Finance", hook: "The 50/30/20 Rule Is Dead", predicted: 78, actual: 89000, delta: 14 },
  { date: "May 8", niche: "Fitness", hook: "Why Your Gym Routine Fails", predicted: 72, actual: 41000, delta: -34 },
  { date: "May 5", niche: "Finance", hook: "I Paid Off $40K in 6 Months", predicted: 90, actual: 210000, delta: 133 },
  { date: "May 2", niche: "Fitness", hook: "3 Exercises You're Doing Wrong", predicted: 68, actual: 52000, delta: -12 },
];

function formatViews(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

export default function PerformanceLoop() {
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
          Recent Posts
        </h2>
        <div className="space-y-2">
          {POSTS.map((post, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.35,
                delay: i * 0.05,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="flex items-center gap-4 bg-card-bg border border-card-border rounded-xl px-5 py-4 group hover:border-card-border/80 transition-colors"
            >
              <span className="text-xs text-muted font-mono w-14 shrink-0">
                {post.date}
              </span>
              <span className="text-[10px] text-muted/60 uppercase tracking-widest w-16 shrink-0">
                {post.niche}
              </span>
              <span className="text-sm font-medium flex-1 truncate">
                {post.hook}
              </span>
              <span className="text-xs text-muted font-mono">
                {post.predicted}
              </span>
              <span className="text-sm font-mono w-16 text-right">
                {formatViews(post.actual)}
              </span>
              <span
                className={`text-xs font-mono font-medium w-14 text-right ${
                  post.delta >= 0 ? "text-success" : "text-danger"
                }`}
              >
                {post.delta >= 0 ? "+" : ""}
                {post.delta}%
              </span>
            </motion.div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-xs text-muted uppercase tracking-widest mb-5 font-medium">
          AI Learning
        </h2>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.25 }}
          className="bg-card-bg border border-card-border rounded-xl p-6"
        >
          <div className="space-y-3 text-sm text-foreground/70 leading-relaxed">
            <p>
              <span className="text-accent mr-2">→</span>
              Contrarian openers underperformed by{" "}
              <span className="text-danger font-medium">34%</span> in fitness.
              Deprioritizing for that niche.
            </p>
            <p>
              <span className="text-accent mr-2">→</span>
              Switching to{" "}
              <span className="text-foreground font-medium">
                &quot;relatable mistake&quot;
              </span>{" "}
              pattern — showed{" "}
              <span className="text-success font-medium">+22%</span> in similar
              niches.
            </p>
            <p>
              <span className="text-accent mr-2">→</span>
              Next prediction accuracy target:{" "}
              <span className="text-foreground font-medium">±15%</span>.
            </p>
          </div>
          <p className="text-[10px] text-muted/50 mt-5 font-mono">
            Updated May 16, 2026
          </p>
        </motion.div>
      </section>
    </div>
  );
}
