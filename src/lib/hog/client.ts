import {
  HogSearchResponse,
  HogOperationResult,
  StrategySchema,
  type HogSearchItem,
  type Strategy,
  STRATEGY_JSON_SCHEMA,
} from "./schema";
import { mockSearchItems, mockStrategy } from "./mock";

const HOG_BASE = "https://developer.thehog.ai";

function getAccessKey(): string | undefined {
  return process.env.HOG_API_KEY || process.env.HOG_ACCESS_KEY || undefined;
}

function getSecretKey(): string | undefined {
  return process.env.HOG_SECRET || process.env.HOG_SECRET_KEY || undefined;
}

function getProjectId(): string | undefined {
  return process.env.HOG_PROJECT_ID || undefined;
}

function isMock(): boolean {
  if (process.env.HOG_MOCK === "1") return true;
  // Auto-mock if no credentials configured
  return !getAccessKey();
}

function authHeaders(): Record<string, string> {
  const access = getAccessKey();
  const secret = getSecretKey();
  if (!access) throw new Error("HOG_API_KEY (or HOG_ACCESS_KEY) missing in env");
  // ak_ keys always use X-Access-Key header (with optional secret).
  if (access.startsWith("ak_")) {
    const headers: Record<string, string> = { "X-Access-Key": access };
    if (secret) headers["X-Secret-Key"] = secret;
    return headers;
  }
  return { Authorization: `Bearer ${access}` };
}

function ymd(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

export function searchIdempotencyKey(nicheSlug: string): string {
  return `search-${nicheSlug}-${ymd()}`;
}

export function researchIdempotencyKey(nicheSlug: string): string {
  return `strategy-${nicheSlug}-${ymd()}`;
}

function resolvePollUrl(pathOrUrl: string): string {
  if (pathOrUrl.startsWith("http")) return pathOrUrl;
  // Hog returns paths like "/v1/search/<id>"; convert to absolute.
  return `${HOG_BASE}/api${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
}

type SubmitSearchInput = {
  query: string;
  type?: string;
  idempotencyKey?: string;
};

export async function submitSearch(
  input: SubmitSearchInput,
): Promise<{ id: string; pollUrl: string; status: string }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...authHeaders(),
  };
  if (input.idempotencyKey) headers["Idempotency-Key"] = input.idempotencyKey;

  const res = await fetch(`${HOG_BASE}/api/v1/search`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      query: input.query,
      type: input.type ?? "tiktok_keyword",
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Hog search failed ${res.status}: ${text.slice(0, 300)}`);
  }
  const parsed = HogSearchResponse.parse(await res.json());
  const id = parsed.id ?? parsed.operationId;
  if (!id) throw new Error("Hog search returned no id");
  const rawPoll = parsed.pollUrl ?? parsed.poll_url ?? `/v1/search/${id}`;
  return { id, pollUrl: resolvePollUrl(rawPoll), status: parsed.status };
}

type SubmitDeepResearchInput = {
  prompt: string;
  urls?: string[];
  schema?: object;
  projectId?: string;
  idempotencyKey?: string;
};

export async function submitDeepResearch(
  input: SubmitDeepResearchInput,
): Promise<{ id: string; pollUrl: string; status: string }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...authHeaders(),
  };
  const projectId = input.projectId ?? getProjectId();
  if (projectId) headers["X-Project-Id"] = projectId;
  if (input.idempotencyKey) headers["Idempotency-Key"] = input.idempotencyKey;

  const res = await fetch(`${HOG_BASE}/api/deep-research`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      prompt: input.prompt,
      schema: input.schema ?? STRATEGY_JSON_SCHEMA,
      urls: input.urls ?? [],
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Hog deep-research failed ${res.status}: ${text.slice(0, 300)}`);
  }
  const parsed = HogSearchResponse.parse(await res.json());
  const id = parsed.id ?? parsed.operationId;
  if (!id) throw new Error("Hog deep-research returned no id");
  const rawPoll = parsed.pollUrl ?? parsed.poll_url ?? `/operations/${id}`;
  return { id, pollUrl: resolvePollUrl(rawPoll), status: parsed.status };
}

type PollOpts = {
  intervalMs?: number;
  timeoutMs?: number;
  onTick?: (status: string, progress?: number) => void;
};

export async function pollOperation(
  pollUrl: string,
  opts: PollOpts = {},
): Promise<HogOperationResult> {
  const intervalMs = opts.intervalMs ?? 10_000;
  const timeoutMs = opts.timeoutMs ?? 360_000;
  const start = Date.now();
  let attempt = 0;
  let delay = intervalMs;

  while (true) {
    const res = await fetch(pollUrl, { headers: authHeaders() });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Hog poll failed ${res.status}: ${text.slice(0, 300)}`);
    }
    const op = HogOperationResult.parse(await res.json());
    opts.onTick?.(op.status, op.progress);

    const terminal = ["succeeded", "failed", "partial_success", "cancelled"];
    if (terminal.includes(op.status)) return op;

    if (Date.now() - start > timeoutMs) {
      throw new Error(
        `Hog poll timed out after ${timeoutMs}ms (last status: ${op.status})`,
      );
    }

    attempt += 1;
    if (attempt > 3) delay = Math.min(delay * 1.5, 30_000);
    await new Promise((r) => setTimeout(r, delay));
  }
}

export type SearchResults = {
  items: HogSearchItem[];
  raw: HogOperationResult;
};

function extractError(op: HogOperationResult): string {
  if (op.error == null) return op.status;
  if (typeof op.error === "string") return op.error;
  return op.error.message ?? op.status;
}

export async function searchHog(
  query: string,
  opts?: {
    type?: string;
    nicheSlug?: string;
    onTick?: PollOpts["onTick"];
  },
): Promise<SearchResults> {
  if (isMock()) {
    return { items: mockSearchItems(query), raw: { id: "mock", status: "succeeded" } };
  }
  const idempotencyKey = opts?.nicheSlug
    ? searchIdempotencyKey(opts.nicheSlug)
    : undefined;
  const { pollUrl } = await submitSearch({
    query,
    type: opts?.type,
    idempotencyKey,
  });
  const op = await pollOperation(pollUrl, { onTick: opts?.onTick });
  if (op.status !== "succeeded" && op.status !== "partial_success") {
    throw new Error(`Hog search ${op.status}: ${extractError(op)}`);
  }
  const items = op.results ?? op.result?.items ?? [];
  return { items, raw: op };
}

export async function deepResearchHog(input: {
  prompt: string;
  urls?: string[];
  nicheSlug?: string;
  projectId?: string;
  onTick?: PollOpts["onTick"];
}): Promise<{ strategy: Strategy; raw: HogOperationResult }> {
  if (isMock()) {
    const strategy = mockStrategy(input.nicheSlug ?? "general");
    return { strategy, raw: { id: "mock", status: "succeeded" } };
  }
  const idempotencyKey = input.nicheSlug
    ? researchIdempotencyKey(input.nicheSlug)
    : undefined;
  const { pollUrl } = await submitDeepResearch({
    prompt: input.prompt,
    urls: input.urls,
    projectId: input.projectId,
    idempotencyKey,
  });
  const op = await pollOperation(pollUrl, { onTick: input.onTick });
  if (op.status !== "succeeded" && op.status !== "partial_success") {
    throw new Error(`Hog deep-research ${op.status}: ${extractError(op)}`);
  }
  const result = op.result ?? op.results;
  if (!result) {
    throw new Error("Hog deep-research returned no result payload");
  }
  const strategy = StrategySchema.parse(result);
  if (!strategy.hashtags.primary_cluster.length) {
    throw new Error("Hog deep-research returned empty primary hashtag cluster");
  }
  return { strategy, raw: op };
}

export function buildSearchQuery(niche: string): string {
  return niche;
}

export function buildDeepResearchPrompt(niche: string): string {
  return [
    `Analyze TikTok content strategy for the niche: "${niche}".`,
    "",
    "Focus on content posted in the last 60 days. For each winning piece of content in the provided URLs, identify:",
    "- the exact hook in the first 3 seconds (or first slide for carousels) — quote it verbatim",
    "- the format (video, carousel, slideshow) and slide-by-slide structure",
    "- the creator handle",
    "- why this pattern is working in this niche right now",
    "- the hashtags used (extract all)",
    "",
    "Then synthesize across all examples to produce the schema.",
    "Be specific: cite EXACT hook phrasings, not generic patterns. Hashtags and hooks are MANDATORY.",
    "Include at least 2 anti-patterns (things that consistently underperform in this niche).",
  ].join("\n");
}

export function pickTopSeeds(
  items: HogSearchItem[],
  opts?: { max?: number },
): string[] {
  const max = opts?.max ?? 8;
  const urls: string[] = [];
  for (const it of items) {
    if (!it.url) continue;
    urls.push(it.url);
    if (urls.length >= max) break;
  }
  return urls;
}
