import { z } from "zod";

export const HogSearchResponse = z
  .object({
    id: z.string().optional(),
    operationId: z.string().optional(),
    status: z.string(),
    pollUrl: z.string().optional(),
    poll_url: z.string().optional(),
    meta: z.unknown().optional(),
  })
  .passthrough();
export type HogSearchResponse = z.infer<typeof HogSearchResponse>;

export const HogOperationStatus = z.enum([
  "queued",
  "pending",
  "processing",
  "succeeded",
  "failed",
  "partial_success",
  "cancelled",
]);
export type HogOperationStatus = z.infer<typeof HogOperationStatus>;

export const HogSearchItem = z
  .object({
    platform: z.string().nullish(),
    url: z.string().nullish(),
    title: z.string().nullish(),
    snippet: z.string().nullish(),
    content: z.string().nullish(),
    author: z.string().nullish(),
    likes: z.number().nullish(),
    plays: z.number().nullish(),
    posted_at: z.string().nullish(),
    published_at: z.string().nullish(),
  })
  .passthrough();
export type HogSearchItem = z.infer<typeof HogSearchItem>;

export const HogErrorPayload = z
  .object({
    message: z.string().optional(),
    retryable: z.boolean().optional(),
  })
  .passthrough();

export const HogOperationResult = z
  .object({
    id: z.string(),
    status: z.string(),
    progress: z.number().optional(),
    results: z.array(HogSearchItem).nullable().optional(),
    total_results: z.number().nullable().optional(),
    type: z.string().optional(),
    query: z.string().optional(),
    result: z
      .object({
        items: z.array(HogSearchItem).optional(),
      })
      .passthrough()
      .nullable()
      .optional(),
    error: z.union([HogErrorPayload, z.string()]).nullable().optional(),
  })
  .passthrough();
export type HogOperationResult = z.infer<typeof HogOperationResult>;

// OpenAI's structured-output strict mode requires every property in
// `properties` to be listed in `required`. To express "optional" the
// field must be nullable. We mark everything nullable for the LLM and
// coalesce null → "" / [] / undefined so downstream code keeps its
// existing happy-path types.
const nstr = () => z.string().nullable().transform((v) => v ?? "");
const narr = <T extends z.ZodTypeAny>(inner: T) =>
  z.array(inner).nullable().transform((v) => v ?? []);

export const HookEntry = z.object({
  text: z.string(),
  archetype: z.string(),
  creator_handle: z.string(),
  source_url: nstr(),
  why_it_works: nstr(),
});
export type HookEntry = z.infer<typeof HookEntry>;

export const FormatEntry = z.object({
  name: z.string(),
  structure: z.string(),
  when_to_use: nstr(),
  example_creator_handles: narr(z.string()),
});
export type FormatEntry = z.infer<typeof FormatEntry>;

export const Hashtags = z.object({
  primary_cluster: z.array(z.string()),
  trending: narr(z.string()),
});

export const Voice = z.object({
  tone: z.string(),
  pacing: nstr(),
  avoid: narr(z.string()),
});

export const AntiPattern = z.object({
  pattern: z.string(),
  why_it_fails: nstr(),
});

export const CreatorEntry = z.object({
  handle: z.string(),
  style: nstr(),
  posting_cadence: nstr(),
});
export type CreatorEntry = z.infer<typeof CreatorEntry>;

export const StrategySchema = z.object({
  niche_slug: z.string(),
  niche_summary: z.string(),
  hooks: z.array(HookEntry).min(1),
  formats: narr(FormatEntry),
  hashtags: Hashtags,
  voice: Voice.nullable().transform((v) => v ?? undefined),
  anti_patterns: narr(AntiPattern),
  creators: narr(CreatorEntry),
});
export type Strategy = z.infer<typeof StrategySchema>;

export const STRATEGY_JSON_SCHEMA = {
  type: "object",
  properties: {
    niche_slug: { type: "string" },
    niche_summary: { type: "string" },
    hooks: {
      type: "array",
      minItems: 3,
      items: {
        type: "object",
        properties: {
          text: { type: "string", description: "Verbatim hook text from a real TikTok" },
          archetype: { type: "string", description: "e.g. contrarian, question, relatable-mistake, listicle" },
          creator_handle: { type: "string" },
          source_url: { type: "string" },
          why_it_works: { type: "string" },
        },
        required: ["text", "archetype", "creator_handle"],
      },
    },
    formats: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          structure: { type: "string" },
          when_to_use: { type: "string" },
          example_creator_handles: { type: "array", items: { type: "string" } },
        },
        required: ["name", "structure"],
      },
    },
    hashtags: {
      type: "object",
      properties: {
        primary_cluster: { type: "array", items: { type: "string" } },
        trending: { type: "array", items: { type: "string" } },
      },
      required: ["primary_cluster"],
    },
    voice: {
      type: "object",
      properties: {
        tone: { type: "string" },
        pacing: { type: "string" },
        avoid: { type: "array", items: { type: "string" } },
      },
      required: ["tone"],
    },
    anti_patterns: {
      type: "array",
      minItems: 2,
      items: {
        type: "object",
        properties: {
          pattern: { type: "string" },
          why_it_fails: { type: "string" },
        },
        required: ["pattern"],
      },
    },
    creators: {
      type: "array",
      items: {
        type: "object",
        properties: {
          handle: { type: "string" },
          style: { type: "string" },
          posting_cadence: { type: "string" },
        },
        required: ["handle"],
      },
    },
  },
  required: ["niche_slug", "niche_summary", "hooks", "hashtags"],
} as const;
