const BACKEND =
  process.env.NEXT_PUBLIC_CAROUSEL_API_BASE ?? "http://localhost:8000";
const CACHE_PREFIX = "brainpost.carousel";

export type CarouselResult = {
  imageUrls: string[];
  logs: string[];
};

type Persona = Record<string, unknown>;

const inflight = new Map<string, Promise<CarouselResult | null>>();

function cacheKey(count: number): string {
  return `${CACHE_PREFIX}.${count}`;
}

export function readCachedCarousel(count: number): CarouselResult | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(cacheKey(count));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CarouselResult;
    if (!Array.isArray(parsed.imageUrls) || parsed.imageUrls.length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCachedCarousel(count: number, data: CarouselResult): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(cacheKey(count), JSON.stringify(data));
  } catch {
    // ignore quota / privacy errors
  }
}

async function streamGenerate(
  count: number,
  persona: Persona,
  signal?: AbortSignal,
): Promise<CarouselResult | null> {
  const response = await fetch(`${BACKEND}/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ persona, count, skip_images: false }),
    signal,
  });
  if (!response.body) return null;

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const logs: string[] = [];
  let imageUrls: string[] = [];

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
        if (event.type === "log" && typeof event.message === "string" && event.message.trim()) {
          logs.push(event.message);
        } else if (event.type === "done") {
          imageUrls = Array.isArray(event.imageUrls) ? event.imageUrls : [];
        }
      } catch {
        continue;
      }
    }
  }

  if (imageUrls.length === 0) return null;
  return { imageUrls, logs };
}

export function ensureCarousel(opts: {
  count: number;
  persona?: Persona;
}): Promise<CarouselResult | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  const { count, persona = {} } = opts;

  const cached = readCachedCarousel(count);
  if (cached) return Promise.resolve(cached);

  const existing = inflight.get(cacheKey(count));
  if (existing) return existing;

  const p = streamGenerate(count, persona)
    .then((result) => {
      if (result) writeCachedCarousel(count, result);
      return result;
    })
    .catch(() => null)
    .finally(() => {
      inflight.delete(cacheKey(count));
    });

  inflight.set(cacheKey(count), p);
  return p;
}

export function prewarmCarousel(opts: { count?: number; persona?: Persona } = {}): void {
  if (typeof window === "undefined") return;
  const count = opts.count ?? 1;
  if (readCachedCarousel(count)) return;
  void ensureCarousel({ count, persona: opts.persona });
}

export function isCarouselInflight(count: number): boolean {
  return inflight.has(cacheKey(count));
}

export function clearCachedCarousel(count: number): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(cacheKey(count));
  } catch {
    // ignore
  }
  inflight.delete(cacheKey(count));
}
