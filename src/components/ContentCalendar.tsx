"use client";

import { useState, useEffect, startTransition, useTransition } from "react";
import { motion, AnimatePresence } from "motion/react";
import { BookOpenText, ChevronLeft, ChevronRight, Eye, Heart, Loader2, MessageCircle, Share2, Sparkles, X } from "lucide-react";
import { generatePerformanceLearningsForGStack, type GStackLearningWrite } from "@/app/actions/insights";
import {
  POST_DATE_BY_ID,
  PREVIOUS_POSTS,
  SCHEDULED_POSTS_BY_DATE,
  type PerformancePost,
} from "@/lib/performance-posts";

// Build DUMMY from real posts + scheduled
function buildDummy(): Record<string, PerformancePost[]> {
  const map: Record<string, PerformancePost[]> = {};
  for (const post of PREVIOUS_POSTS) {
    const date = POST_DATE_BY_ID[post.id];
    if (!date) continue;
    if (!map[date]) map[date] = [];
    map[date].push(post);
  }
  for (const [date, posts] of Object.entries(SCHEDULED_POSTS_BY_DATE)) {
    map[date] = posts;
  }
  return map;
}

const DUMMY = buildDummy();

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

function toKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isToday(date: Date): boolean {
  return toKey(date) === toKey(new Date());
}

function getWeekDays(monday: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    return d;
  });
}

export default function ContentCalendar() {
  // SSR returns null; client populates on mount via startTransition so the
  // hydration sync doesn't trigger a cascading render (react-hooks/set-state-in-effect).
  const [weekStart, setWeekStart] = useState<Date | null>(null);
  const [selected, setSelected] = useState<PerformancePost | null>(null);
  const [gstackWrite, setGstackWrite] = useState<GStackLearningWrite | null>(null);
  const [gstackStatus, setGstackStatus] = useState("");
  const [isGenerating, startGenerating] = useTransition();

  useEffect(() => {
    startTransition(() => setWeekStart(getMonday(new Date())));
  }, []);

  if (!weekStart) return null;

  const days = getWeekDays(weekStart);

  const prevWeek = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() - 7);
    setWeekStart(d);
  };

  const nextWeek = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    setWeekStart(d);
  };

  const weekEnd = days[6];
  const startLabel = weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const endLabel = weekEnd.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  function onGenerateLearnings() {
    setGstackStatus("Generating learnings from previous posts...");
    startGenerating(async () => {
      try {
        const result = await generatePerformanceLearningsForGStack();
        setGstackWrite(result);
        setGstackStatus(`Written to GStack: ${result.slug}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setGstackStatus(`error: ${msg}`);
      }
    });
  }

  return (
    <div className="relative">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Performance</h1>
          <p className="text-sm text-muted mt-1">Content from @tylerbrooks.lifts</p>
        </div>
        <div className="flex flex-col items-end gap-3">
          <button
            onClick={onGenerateLearnings}
            disabled={isGenerating}
            className="inline-flex items-center gap-1.5 bg-accent hover:bg-accent-hover text-white text-xs px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-wait"
          >
            {isGenerating ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Sparkles className="w-3 h-3" />
            )}
            Generate learnings
          </button>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted tabular-nums">{startLabel} — {endLabel}</span>
            <div className="flex items-center gap-0.5">
              <button onClick={prevWeek} className="p-1.5 rounded-md text-muted hover:text-foreground hover:bg-subtle transition-colors cursor-pointer">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={nextWeek} className="p-1.5 rounded-md text-muted hover:text-foreground hover:bg-subtle transition-colors cursor-pointer">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
          {gstackStatus && (
            <p className="text-[10px] text-muted/60 font-mono">{gstackStatus}</p>
          )}
        </div>
      </div>

      {gstackWrite && (
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="mb-8 bg-card-bg border border-card-border rounded-lg overflow-hidden"
        >
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-card-border">
            <div className="flex items-center gap-2 min-w-0">
              <BookOpenText className="w-4 h-4 text-accent shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-medium">GStack write</p>
                <p className="text-[10px] text-muted font-mono truncate">{gstackWrite.slug}</p>
              </div>
            </div>
            <span className="text-[10px] text-muted/60 font-mono shrink-0">
              {gstackWrite.learning.patterns.length} learnings
            </span>
          </div>
          <div className="space-y-4 p-4">
            {gstackWrite.learning.patterns.map((pattern, index) => (
              <div key={`${pattern.pattern}-${index}`} className="rounded-md border border-card-border bg-background/40 p-3">
                <p className="text-sm font-medium text-foreground">
                  {index + 1}. {pattern.pattern}
                </p>
                <p className="mt-2 text-xs leading-relaxed text-muted">
                  {pattern.evidence}
                </p>
                <p className="mt-2 text-xs leading-relaxed text-foreground/70">
                  {pattern.recommendation}
                </p>
              </div>
            ))}
          </div>
          <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-words border-t border-card-border p-4 text-[11px] leading-relaxed text-foreground/60 font-mono">
            {gstackWrite.content}
          </pre>
        </motion.section>
      )}

      {/* Calendar grid */}
      <div className="overflow-x-auto -mx-6 px-6">
        <div className="grid grid-cols-7 gap-2.5 min-w-[700px]">
          {days.map((day, i) => {
            const key = toKey(day);
            const posts = DUMMY[key] ?? [];
            const today = isToday(day);
            const dayNum = day.getDate();
            const dayName = day.toLocaleDateString("en-US", { weekday: "short" });
            const isPast = day < new Date() && !today;

            return (
              <div key={key}>
                <div className="flex flex-col items-center mb-3 pb-3 border-b border-card-border">
                  <span className="text-[10px] text-muted uppercase tracking-widest mb-1.5">{dayName}</span>
                  <div className={`w-7 h-7 flex items-center justify-center rounded-full text-sm font-semibold ${today ? "bg-foreground text-background" : "text-foreground"}`}>
                    {dayNum}
                  </div>
                </div>

                <div className="space-y-2">
                  {posts.map((post, j) => (
                    <motion.div
                      key={post.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: i * 0.03 + j * 0.05, ease: [0.16, 1, 0.3, 1] }}
                      onClick={() => setSelected(post)}
                      className={`rounded-lg border overflow-hidden cursor-pointer select-none transition-colors ${
                        selected?.id === post.id
                          ? "border-accent/60"
                          : post.status === "done"
                            ? "border-success/20 hover:border-success/40"
                            : "border-card-border hover:border-card-border/60"
                      } ${isPast && post.status === "scheduled" ? "opacity-50" : ""}`}
                    >
                      {/* Thumbnail */}
                      {post.thumbnail && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={post.thumbnail}
                          alt=""
                          className="w-full aspect-[9/12] object-cover"
                        />
                      )}
                      <div className={`p-2 ${post.status === "done" ? "bg-success/5" : "bg-card-bg"}`}>
                        <p className="text-[10px] font-medium leading-snug line-clamp-2 mb-1.5 text-foreground/80">
                          {post.title}
                        </p>
                        <div className="flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${post.status === "done" ? "bg-success" : "bg-accent"}`} />
                          <span className={`text-[10px] font-medium ${post.status === "done" ? "text-success" : "text-accent"}`}>
                            {post.status === "done" ? "Done" : "Scheduled"}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  ))}

                  {posts.length === 0 && (
                    <div className="rounded-lg border border-dashed border-card-border p-3 flex items-center justify-center">
                      <span className="text-[10px] text-muted/40">—</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Detail sidebar */}
      <AnimatePresence>
        {selected && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setSelected(null)}
              className="fixed inset-0 z-40"
            />
            <motion.aside
              key="sidebar"
              initial={{ opacity: 0, x: 32 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 32 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="fixed top-0 right-0 h-full w-80 bg-background border-l border-card-border z-50 flex flex-col shadow-2xl"
            >
              {/* Sidebar header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-card-border flex-shrink-0">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${selected.status === "done" ? "bg-success" : "bg-accent"}`} />
                  <span className={`text-xs font-medium ${selected.status === "done" ? "text-success" : "text-accent"}`}>
                    {selected.status === "done" ? "Done" : "Scheduled"}
                  </span>
                </div>
                <button onClick={() => setSelected(null)} className="p-1 rounded-md text-muted hover:text-foreground hover:bg-subtle transition-colors cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto">
                {/* Thumbnail */}
                {selected.thumbnail && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={selected.thumbnail}
                    alt=""
                    className="w-full aspect-[9/14] object-cover"
                  />
                )}

                <div className="px-5 py-5 space-y-5">
                  {/* Title */}
                  <div>
                    <p className="text-[10px] text-muted/60 uppercase tracking-widest mb-2">Title</p>
                    <p className="text-sm font-semibold leading-snug text-foreground">{selected.title}</p>
                  </div>

                  {/* Stats */}
                  {selected.status === "done" && selected.stats && (
                    <div>
                      <p className="text-[10px] text-muted/60 uppercase tracking-widest mb-3">Performance</p>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { icon: Eye, label: "Views", value: selected.stats.views },
                          { icon: Heart, label: "Likes", value: selected.stats.likes },
                          { icon: MessageCircle, label: "Comments", value: selected.stats.comments },
                          { icon: Share2, label: "Shares", value: selected.stats.shares },
                        ].map(({ icon: Icon, label, value }) => (
                          <div key={label} className="bg-card-bg border border-card-border rounded-lg p-3">
                            <div className="flex items-center gap-1.5 mb-1">
                              <Icon className="w-3 h-3 text-muted/60" />
                              <span className="text-[10px] text-muted/60">{label}</span>
                            </div>
                            <p className="text-sm font-semibold tabular-nums">{fmt(value)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Scheduled time */}
                  {selected.status === "scheduled" && selected.scheduledTime && (
                    <div>
                      <p className="text-[10px] text-muted/60 uppercase tracking-widest mb-2">Scheduled time</p>
                      <p className="text-sm font-medium text-accent">{selected.scheduledTime}</p>
                    </div>
                  )}

                  {/* Caption */}
                  {selected.caption && (
                    <div>
                      <p className="text-[10px] text-muted/60 uppercase tracking-widest mb-2">Caption</p>
                      <p className="text-xs text-foreground/70 leading-relaxed whitespace-pre-line">{selected.caption}</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
