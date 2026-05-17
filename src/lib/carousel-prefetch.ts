const BACKEND =
  process.env.NEXT_PUBLIC_CAROUSEL_BACKEND_URL ?? "http://localhost:8000";
const CACHE_PREFIX = "brainpost.carousel";

export type CarouselResult = {
  imageUrls: string[];
  logs: string[];
};

type Persona = Record<string, unknown>;

const inflight = new Map<string, Promise<CarouselResult | null>>();

function hashPersona(persona: Persona): string {
  if (!persona || Object.keys(persona).length === 0) return "default";
  try {
    const json = JSON.stringify(persona);
    let h = 5381;
    for (let i = 0; i < json.length; i++) {
      h = ((h << 5) + h + json.charCodeAt(i)) | 0;
    }
    return (h >>> 0).toString(36);
  } catch {
    return "default";
  }
}

function cacheKey(count: number, persona: Persona = {}): string {
  return `${CACHE_PREFIX}.${count}.${hashPersona(persona)}`;
}

export function readCachedCarousel(
  count: number,
  persona: Persona = {},
): CarouselResult | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(cacheKey(count, persona));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CarouselResult;
    if (!Array.isArray(parsed.imageUrls) || parsed.imageUrls.length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCachedCarousel(
  count: number,
  persona: Persona,
  data: CarouselResult,
): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(cacheKey(count, persona), JSON.stringify(data));
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
  const key = cacheKey(count, persona);

  const cached = readCachedCarousel(count, persona);
  if (cached) return Promise.resolve(cached);

  const existing = inflight.get(key);
  if (existing) return existing;

  const p = streamGenerate(count, persona)
    .then((result) => {
      if (result) writeCachedCarousel(count, persona, result);
      return result;
    })
    .catch(() => null)
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, p);
  return p;
}

export function prewarmCarousel(opts: { count?: number; persona?: Persona } = {}): void {
  if (typeof window === "undefined") return;
  const count = opts.count ?? 1;
  const persona = opts.persona ?? {};
  if (readCachedCarousel(count, persona)) return;
  void ensureCarousel({ count, persona });
}

export function isCarouselInflight(count: number, persona: Persona = {}): boolean {
  return inflight.has(cacheKey(count, persona));
}

export function clearCachedCarousel(count: number, persona: Persona = {}): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(cacheKey(count, persona));
  } catch {
    // ignore
  }
  inflight.delete(cacheKey(count, persona));
}
