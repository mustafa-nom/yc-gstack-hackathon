"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronLeft, ChevronRight, X, Eye, Heart, MessageCircle, Share2 } from "lucide-react";

type Status = "done" | "scheduled";

interface Stats { views: number; likes: number; comments: number; shares: number }

interface Post {
  id: string;
  title: string;
  status: Status;
  thumbnail?: string;
  caption?: string;
  stats?: Stats;
  scheduledTime?: string;
}

// Real posts from @tylerbrooks.lifts
const REAL: Post[] = [
  { id: "7640388791521299726", status: "done", title: "if you are over 6 feet and you have been lifting for a while you have probably been told you are built for endurance not strength", thumbnail: "/thumbs/7640388791521299726.jpeg", caption: "#lifting #fitness #strengthtraining #talllifters #gymadvice", stats: { views: 878, likes: 26, comments: 2, shares: 1 } },
  { id: "7639791124252544286", status: "done", title: "most lifters treat deload weeks like a sign of weakness like if you take a lighter week you are going soft", thumbnail: "/thumbs/7639791124252544286.jpeg", caption: "#deload #recovery #gymlife #liftingadvice #strengthtraining", stats: { views: 903, likes: 22, comments: 2, shares: 3 } },
  { id: "7639655291029622029", status: "done", title: "becoming a dad does not mean your physique has to disappear but pretty much every piece of advice out there assumes you still have the same schedule you did at 24", thumbnail: "/thumbs/7639655291029622029.jpeg", caption: "#dadfitness #fitdad #gymlife #busydad #physique", stats: { views: 12500, likes: 102, comments: 2, shares: 0 } },
  { id: "7639253997185961247", status: "done", title: "the transition from college athlete to regular adult is where most guys lose the gym for good", thumbnail: "/thumbs/7639253997185961247.jpeg", caption: "#collegeathlete #adultfitness #gymlife #fitness #transition", stats: { views: 942, likes: 22, comments: 0, shares: 0 } },
  { id: "7638927125596097823", status: "done", title: "the guys who look like they live in the gym a lot of them are there four days a week", thumbnail: "/thumbs/7638927125596097823.jpeg", caption: "#gymefficiency #workoutsplit #fitnesstips #gymlife #4dayworkout", stats: { views: 816, likes: 25, comments: 0, shares: 0 } },
  { id: "7638506969095081247", status: "done", title: "most lifters treat cardio like it is the enemy of gains and if you are running 5 miles a day on top of heavy lifting that might be true", thumbnail: "/thumbs/7638506969095081247.jpeg", caption: "#cardio #gains #lifting #fitnesstips #musclebuilding", stats: { views: 430, likes: 10, comments: 0, shares: 0 } },
  { id: "7636527260677311758", status: "done", title: "the gym in college feels like the one thing you can control classes stress social stuff the gym is yours", thumbnail: "/thumbs/7636527260677311758.jpeg", caption: "#collegefitness #gymlife #studentathlete #mentalhealth #lifting", stats: { views: 1160, likes: 40, comments: 0, shares: 1 } },
  { id: "7636240073238859038", status: "done", title: "the fitness internet will have you believe that anything less than a perfect program perfectly executed is a waste of time", thumbnail: "/thumbs/7636240073238859038.jpeg", caption: "#fitnessmyths #gym #liftingadvice #fitness #programdesign", stats: { views: 46, likes: 0, comments: 0, shares: 0 } },
  { id: "7635855429465017631", status: "done", title: "most guys hit a wall and their first instinct is to add more volume more sets more days more exercises", thumbnail: "/thumbs/7635855429465017631.jpeg", caption: "#plateau #training #overtraining #gymadvice #volume", stats: { views: 513, likes: 23, comments: 0, shares: 0 } },
  { id: "7635505161065991455", status: "done", title: "Most guys with day jobs and partners and obligations think they need to overhaul their entire life to get back in shape", thumbnail: "/thumbs/7635505161065991455.jpeg", caption: "#busylifestyle #gymlife #fitness #worklifebalance #dadlife", stats: { views: 435, likes: 15, comments: 0, shares: 0 } },
  { id: "7635138094315932958", status: "done", title: "Some weeks the program holds. Some weeks Tuesday eats your squat session alive", thumbnail: "/thumbs/7635138094315932958.jpeg", caption: "#gymlife #consistency #liftinglife #squats #training", stats: { views: 355, likes: 7, comments: 0, shares: 0 } },
  { id: "7634628799740644622", status: "done", title: "Cutting is where most lifters watch a year of gains slip in eight weeks", thumbnail: "/thumbs/7634628799740644622.jpeg", caption: "#cutting #fatloss #musclemass #diet #bodyrecomp", stats: { views: 446, likes: 9, comments: 1, shares: 0 } },
  { id: "7634264872578059551", status: "done", title: "Ten years in the gym and the things I wish I had known on day one are not what you would expect", thumbnail: "/thumbs/7634264872578059551.jpeg", caption: "#gymwisdom #liftingadvice #10years #fitness #gymlife", stats: { views: 317, likes: 5, comments: 0, shares: 0 } },
  { id: "7633826380903370015", status: "done", title: "Shift work breaks the textbook training advice. You cannot eat at the same time every day sleep at the same time every night or train on a fixed schedule", thumbnail: "/thumbs/7633826380903370015.jpeg", caption: "#shiftwork #gymlife #fitness #nightshift #workerlife", stats: { views: 351, likes: 15, comments: 0, shares: 0 } },
];

// Map video ID → date (UTC)
const ID_TO_DATE: Record<string, string> = {
  "7640388791521299726": "2026-05-16",
  "7639791124252544286": "2026-05-14",
  "7639655291029622029": "2026-05-14",
  "7639253997185961247": "2026-05-13",
  "7638927125596097823": "2026-05-12",
  "7638506969095081247": "2026-05-11",
  "7636527260677311758": "2026-05-05",
  "7636240073238859038": "2026-05-05",
  "7635855429465017631": "2026-05-04",
  "7635505161065991455": "2026-05-03",
  "7635138094315932958": "2026-05-02",
  "7634628799740644622": "2026-04-30",
  "7634264872578059551": "2026-04-29",
  "7633826380903370015": "2026-04-28",
};

// Future scheduled posts (dummy)
const SCHEDULED: Record<string, Post[]> = {
  "2026-05-17": [
    { id: "s1", status: "scheduled", title: "The protein myth most lifters still believe in 2026", scheduledTime: "12:00 PM" },
    { id: "s2", status: "scheduled", title: "How to stay consistent when life gets completely in the way", scheduledTime: "7:00 PM" },
  ],
  "2026-05-19": [
    { id: "s3", status: "scheduled", title: "3 compound lifts you should never skip no matter how busy you are", scheduledTime: "12:00 PM" },
  ],
  "2026-05-20": [
    { id: "s4", status: "scheduled", title: "What I wish I knew before my first cut", scheduledTime: "6:30 PM" },
  ],
  "2026-05-21": [
    { id: "s5", status: "scheduled", title: "The mindset shift that actually changed how I train", scheduledTime: "5:00 PM" },
  ],
};

// Build DUMMY from real posts + scheduled
function buildDummy(): Record<string, Post[]> {
  const map: Record<string, Post[]> = {};
  for (const post of REAL) {
    const date = ID_TO_DATE[post.id];
    if (!date) continue;
    if (!map[date]) map[date] = [];
    map[date].push(post);
  }
  for (const [date, posts] of Object.entries(SCHEDULED)) {
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
  const [weekStart, setWeekStart] = useState<Date>(new Date(0));
  const [mounted, setMounted] = useState(false);
  const [selected, setSelected] = useState<Post | null>(null);

  useEffect(() => {
    setWeekStart(getMonday(new Date()));
    setMounted(true);
  }, []);

  if (!mounted) return null;

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

  return (
    <div className="relative">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Schedule</h1>
          <p className="text-sm text-muted mt-1">Content from @tylerbrooks.lifts</p>
        </div>
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
      </div>

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

              <div className="flex-1 overflow-y-auto overscroll-contain" data-lenis-prevent>
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
