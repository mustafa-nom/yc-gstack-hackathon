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
  caption: string;
  stats?: Stats;
  scheduledTime?: string;
}

const DUMMY: Record<string, Post[]> = {
  "2026-05-10": [
    {
      id: "a1", title: "5 Things That Fixed My Morning", status: "done",
      caption: "Your morning sets the tone for everything. Here are 5 small changes that actually stuck for me — no 5am wake-ups required.\n\n#morningroutine #productivity #selfimprovement #habitstacking #dailyroutine",
      stats: { views: 84200, likes: 3100, comments: 218, shares: 940 },
    },
    {
      id: "a2", title: "Stop Doing These 3 Exercises", status: "done",
      caption: "Not every popular exercise is worth your time. These 3 are hurting more people than they're helping — and there are better alternatives.\n\n#fitness #gymtips #workout #liftingadvice #gains",
      stats: { views: 61400, likes: 2400, comments: 305, shares: 720 },
    },
    {
      id: "a3", title: "Why I Quit Multitasking", status: "done",
      caption: "Multitasking feels productive. It isn't. Here's what changed when I started doing one thing at a time.\n\n#focus #deepwork #productivity #mentalhealth #mindset",
      stats: { views: 47800, likes: 1900, comments: 143, shares: 510 },
    },
  ],
  "2026-05-11": [
    {
      id: "b1", title: "The Workout Split Nobody Talks About", status: "done",
      caption: "Everyone's doing PPL or bro splits. This split gave me better results in less time — and it fits a real schedule.\n\n#workoutsplit #gymroutine #fitness #musclebuilding #liftinglife",
      stats: { views: 112000, likes: 5200, comments: 487, shares: 1840 },
    },
    {
      id: "b2", title: "How I Cut My Screen Time in Half", status: "done",
      caption: "I was at 7 hours a day. Now I'm under 3. These are the only changes that actually made a difference.\n\n#screentime #digitalwellness #productivity #phonefree #mindfultech",
      stats: { views: 53600, likes: 2100, comments: 196, shares: 630 },
    },
  ],
  "2026-05-12": [
    {
      id: "c1", title: "Best Pre-Workout Meals for Lifters", status: "done",
      caption: "What you eat before training matters more than most people think. These meals give me consistent energy without the crash.\n\n#preworkout #gymnutrition #mealprep #fitnessfood #liftingdiet",
      stats: { views: 39200, likes: 1600, comments: 124, shares: 410 },
    },
    {
      id: "c2", title: "3 Habits I Added to My Night Routine", status: "done",
      caption: "My mornings got better when I fixed my nights. These 3 habits take under 20 minutes and actually work.\n\n#nightroutine #sleephygiene #habitbuilding #wellness #selfcare",
      stats: { views: 71500, likes: 3300, comments: 261, shares: 890 },
    },
    {
      id: "c3", title: "What I Eat in a Day to Stay Lean", status: "done",
      caption: "No tracking apps. No calorie counting. Just a simple approach to eating that keeps me consistent year-round.\n\n#whatieatinaday #leanlifestyle #intuitiveeating #fitnessdiet #bodyrecomp",
      stats: { views: 98300, likes: 4700, comments: 392, shares: 1520 },
    },
  ],
  "2026-05-13": [
    {
      id: "d1", title: "I Tracked My Sleep for 30 Days — Here's What Happened", status: "done",
      caption: "I wore a tracker every night for a month. The data surprised me — especially what was wrecking my deep sleep.\n\n#sleeptracking #sleepscience #recoverytips #whoop #oura",
      stats: { views: 143000, likes: 6800, comments: 714, shares: 2300 },
    },
    {
      id: "d2", title: "Apps That Actually Helped My Focus", status: "done",
      caption: "I've tried every focus app out there. These are the only ones I still use after 6 months.\n\n#focusapps #productivity #adhd #deepwork #workfromhome",
      stats: { views: 66700, likes: 2900, comments: 338, shares: 780 },
    },
  ],
  "2026-05-14": [
    {
      id: "e1", title: "Why Your Gym Routine Isn't Working", status: "done",
      caption: "Most people aren't failing because of effort. They're failing because of these 3 mistakes that nobody talks about.\n\n#gymfails #fitnessadvice #musclegrowth #workoutmistakes #gains",
      stats: { views: 187000, likes: 9100, comments: 832, shares: 3100 },
    },
    {
      id: "e2", title: "5 Lifts to Build a Bigger Back", status: "done",
      caption: "A wide back changes your entire physique. These 5 movements hit every angle and are worth adding to your pull day.\n\n#backworkout #pullday #musclebuilding #gymbro #backgains",
      stats: { views: 94500, likes: 4300, comments: 402, shares: 1270 },
    },
    {
      id: "e3", title: "Things I Stopped Buying to Save Money", status: "done",
      caption: "Cut these and I saved $400/month without feeling like I was sacrificing anything. Real talk.\n\n#moneysaving #budgeting #personalfinance #frugalliving #savemoney",
      stats: { views: 51200, likes: 2000, comments: 187, shares: 560 },
    },
  ],
  "2026-05-15": [
    {
      id: "f1", title: "The Morning Routine I Swear By", status: "done",
      caption: "I've tested dozens of morning routines. This one is the only one I've kept for over a year — and it takes less than 45 minutes.\n\n#morningroutine #morninghabits #selfimprovement #5amclub #dailyhabits",
      stats: { views: 77400, likes: 3500, comments: 289, shares: 1010 },
    },
    {
      id: "f2", title: "How I Meal Prep for the Week in 2 Hours", status: "done",
      caption: "Sunday meal prep doesn't have to take all day. Here's my exact system — from grocery list to fridge in under 2 hours.\n\n#mealprep #mealprepping #healthyeating #fitnessmeal #sundaymealprep",
      stats: { views: 88900, likes: 4100, comments: 367, shares: 1340 },
    },
  ],
  "2026-05-16": [
    {
      id: "g1", title: "Supplements Worth Buying in 2026", status: "done",
      caption: "The supplement industry is full of noise. These are the only ones with real evidence behind them — and I've tried everything.\n\n#supplements #creatine #proteinpowder #fitnesstips #evidencebased",
      stats: { views: 34100, likes: 1500, comments: 98, shares: 320 },
    },
    {
      id: "g2", title: "5 Signs You're Overtraining", status: "scheduled",
      caption: "More isn't always better. If you're hitting the gym 6 days a week and your progress has stalled, this might be why.\n\n#overtraining #recoverydays #fitnessadvice #restday #gymlife",
      scheduledTime: "6:00 PM",
    },
  ],
  "2026-05-17": [
    {
      id: "h1", title: "The Protein Myth Most People Believe", status: "scheduled",
      caption: "You don't need 1g per pound of bodyweight. Here's what the research actually says — and how much you actually need.\n\n#protein #nutritionscience #musclebuilding #dietadvice #fitnessmyths",
      scheduledTime: "12:00 PM",
    },
    {
      id: "h2", title: "How to Stay Consistent When Life Gets Busy", status: "scheduled",
      caption: "Consistency isn't about motivation. It's about systems. Here's how I've stayed on track through busy seasons for 3 years.\n\n#consistency #habitbuilding #fitnessjourney #gymlife #discipline",
      scheduledTime: "7:00 PM",
    },
  ],
  "2026-05-18": [
    {
      id: "i1", title: "3 Compound Lifts You Should Never Skip", status: "scheduled",
      caption: "If you only have time for 3 movements, make them these. They hit the most muscle, burn the most calories, and build real strength.\n\n#compoundlifts #strengthtraining #squat #deadlift #benchpress",
      scheduledTime: "3:00 PM",
    },
  ],
  "2026-05-19": [
    {
      id: "j1", title: "What I Wish I Knew Before Cutting", status: "scheduled",
      caption: "My first cut was a disaster. Here's everything I'd tell myself before starting — so you don't make the same mistakes.\n\n#cuttingseason #fatloss #bodyrecomp #gymjourney #fitnessadvice",
      scheduledTime: "12:00 PM",
    },
    {
      id: "j2", title: "The Lazy Person's Guide to Meal Prep", status: "scheduled",
      caption: "No complicated recipes. No hours in the kitchen. This is how I eat well every week with minimal effort.\n\n#easymealprep #lazymealprep #healthyeating #simplerecipes #mealplanning",
      scheduledTime: "6:30 PM",
    },
  ],
  "2026-05-20": [
    {
      id: "k1", title: "How to Build Muscle on a Budget", status: "scheduled",
      caption: "You don't need expensive supplements or a premium gym. Here's how to maximize gains on $50/week or less.\n\n#budgetfitness #musclebuilding #frugalfitness #gymtips #gains",
      scheduledTime: "11:00 AM",
    },
    {
      id: "k2", title: "I Replaced Coffee with This for 2 Weeks", status: "scheduled",
      caption: "I was skeptical. Two weeks in, my focus was sharper and I wasn't crashing at 2pm. Here's what I switched to.\n\n#coffeealternative #energydrink #focus #nootropics #morningroutine",
      scheduledTime: "8:00 AM",
    },
  ],
  "2026-05-21": [
    {
      id: "l1", title: "The Mindset Shift That Changed My Training", status: "scheduled",
      caption: "I used to train for aesthetics. Shifting to performance changed everything — my physique actually got better as a byproduct.\n\n#fitnessmindset #athletictraining #strengthgoals #gymphilosophy #performancefirst",
      scheduledTime: "5:00 PM",
    },
    {
      id: "l2", title: "Why Rest Days Are Just as Important", status: "scheduled",
      caption: "Growth doesn't happen in the gym. It happens when you recover. Here's why your rest days are actually doing the heavy lifting.\n\n#restday #musclerecovery #activerecovery #sleepandgains #gymscience",
      scheduledTime: "7:30 PM",
    },
  ],
  "2026-05-22": [
    {
      id: "m1", title: "5 Things Every Lifter Needs in Their Bag", status: "scheduled",
      caption: "After 4 years in the gym, these are the only things that actually earn their spot in my gym bag every single day.\n\n#gymbag #gymessentials #liftingaccessories #gymgear #workoutgear",
      scheduledTime: "4:00 PM",
    },
  ],
  "2026-05-23": [
    {
      id: "n1", title: "My Full Body Routine for Busy Weeks", status: "scheduled",
      caption: "When life gets in the way, I drop to 3 days and run this full-body split. Never lost gains doing it.\n\n#fullbodyworkout #3dayworkout #busyschedule #gymroutine #efficienttraining",
      scheduledTime: "12:00 PM",
    },
    {
      id: "n2", title: "How I Lost Fat Without Losing Strength", status: "scheduled",
      caption: "Most cuts come with strength loss. Mine didn't. Here's the exact approach I used to keep every lift going up while dropping weight.\n\n#fatlosswithoutmuscleloss #cuttingphase #strengthtraining #bodyrecomp #liftingwhilecutting",
      scheduledTime: "6:00 PM",
    },
  ],
};

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
  return date.toISOString().slice(0, 10);
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
          <p className="text-sm text-muted mt-1">Your content calendar for the week.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted tabular-nums">
            {startLabel} — {endLabel}
          </span>
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
                      className={`rounded-lg border p-2.5 cursor-pointer select-none transition-colors ${
                        selected?.id === post.id
                          ? "border-accent/60 bg-accent/5"
                          : post.status === "done"
                            ? "bg-success/5 border-success/20 hover:border-success/40"
                            : "bg-card-bg border-card-border hover:border-card-border/60"
                      } ${isPast && post.status === "scheduled" ? "opacity-50" : ""}`}
                    >
                      <p className="text-[11px] font-medium leading-snug line-clamp-2 mb-2 text-foreground/90">
                        {post.title}
                      </p>
                      <div className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${post.status === "done" ? "bg-success" : "bg-accent"}`} />
                        <span className={`text-[10px] font-medium ${post.status === "done" ? "text-success" : "text-accent"}`}>
                          {post.status === "done" ? "Done" : "Scheduled"}
                        </span>
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
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setSelected(null)}
              className="fixed inset-0 z-40"
            />

            {/* Sidebar */}
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
                <button
                  onClick={() => setSelected(null)}
                  className="p-1 rounded-md text-muted hover:text-foreground hover:bg-subtle transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Sidebar body */}
              <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
                {/* Title */}
                <div>
                  <p className="text-[10px] text-muted/60 uppercase tracking-widest mb-2">Title</p>
                  <p className="text-sm font-semibold leading-snug text-foreground">{selected.title}</p>
                </div>

                {/* Stats (done only) */}
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
                <div>
                  <p className="text-[10px] text-muted/60 uppercase tracking-widest mb-2">Caption</p>
                  <p className="text-xs text-foreground/70 leading-relaxed whitespace-pre-line">{selected.caption}</p>
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
