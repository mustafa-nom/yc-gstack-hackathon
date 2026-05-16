import type { HogSearchItem } from "./schema";
import type { Strategy } from "./schema";

const ARCHETYPES = [
  "contrarian",
  "question",
  "relatable-mistake",
  "us-vs-them",
  "listicle",
  "pov",
];

const CREATOR_POOL = [
  "@buildwithjess",
  "@itsalexander",
  "@notamiketok",
  "@sarah.makes",
  "@danielcodes",
  "@priyabuilds",
  "@theresaedits",
];

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length];
}

export function mockSearchItems(query: string): HogSearchItem[] {
  return Array.from({ length: 6 }).map((_, i) => ({
    platform: "tiktok",
    url: `https://www.tiktok.com/@${pick(CREATOR_POOL, i).slice(1)}/video/74${i}00${i}`,
    title: `${query} — ${pick(ARCHETYPES, i)} take`,
    author: pick(CREATOR_POOL, i),
    posted_at: new Date(Date.now() - i * 86_400_000).toISOString(),
  }));
}

export function mockStrategy(niche: string): Strategy {
  const cleanNiche = niche || "general";
  const hookTemplates = [
    (n: string) => `Stop doing X if you want to win at ${n}`,
    (n: string) => `Why everyone teaching ${n} is wrong`,
    (n: string) => `${n} mistakes that cost you a year`,
    (n: string) => `POV: you just unlocked the ${n} cheat code`,
    (n: string) => `${n} is broken. Here is the fix.`,
    (n: string) => `What nobody tells you about ${n}`,
  ];

  const hooks = hookTemplates.map((t, i) => ({
    text: t(cleanNiche),
    archetype: pick(ARCHETYPES, i),
    creator_handle: pick(CREATOR_POOL, i),
    source_url: `https://www.tiktok.com/@${pick(CREATOR_POOL, i).slice(1)}/video/8${i}001`,
    why_it_works: `Pattern interrupt: positions the creator as a contrarian authority in ${cleanNiche}.`,
  }));

  const creators = CREATOR_POOL.slice(0, 5).map((handle, i) => ({
    handle,
    style: i % 2 === 0 ? "Direct, listicle-heavy, fast cuts" : "POV-style, casual to-camera",
    posting_cadence: i % 2 === 0 ? "5x/week" : "3x/week",
  }));

  return {
    niche_slug: niche,
    niche_summary: `Top-performing ${cleanNiche} content in the last 60 days mixes contrarian hooks with 6-7 slide carousels. Creators who lean into specific numbers and named tools outperform generic motivational copy.`,
    hooks,
    formats: [
      {
        name: "7-slide-carousel",
        structure: "Hook → Problem → 3 Tips → Social Proof → CTA",
        when_to_use: "Best for educational content where saves matter",
        example_creator_handles: CREATOR_POOL.slice(0, 3),
      },
      {
        name: "talking-head-pov",
        structure: "Hot take → Reasoning → Counter-objection → Soft CTA",
        when_to_use: "Best for thought leadership and follower growth",
        example_creator_handles: CREATOR_POOL.slice(2, 5),
      },
    ],
    hashtags: {
      primary_cluster: [cleanNiche.replace(/\s+/g, ""), "buildinpublic", "tiktoktips"],
      trending: ["fyp", "creatortok", "indiedev"],
    },
    voice: {
      tone: "Direct, slightly contrarian, no motivational filler",
      pacing: "Punchy, sentence breaks, 7-12 words per slide",
      avoid: ["humblebrags", "generic motivational copy", "vague advice"],
    },
    anti_patterns: [
      {
        pattern: "Long-form thought leadership with no hook",
        why_it_fails: "Viewers swipe within 1.2s without a clear pattern interrupt",
      },
      {
        pattern: "Stock-photo style backgrounds with overlay text",
        why_it_fails: "Reads as low-effort and tanks completion rate",
      },
    ],
    creators,
  };
}
