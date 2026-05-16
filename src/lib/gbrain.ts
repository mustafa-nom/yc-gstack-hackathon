import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

type Slug = string;

const pageMutex = new Map<Slug, Promise<unknown>>();

async function withPageLock<T>(slug: Slug, fn: () => Promise<T>): Promise<T> {
  const prev = pageMutex.get(slug) ?? Promise.resolve();
  const next = prev.then(fn, fn);
  pageMutex.set(slug, next);
  try {
    return (await next) as T;
  } finally {
    if (pageMutex.get(slug) === next) pageMutex.delete(slug);
  }
}

const GBRAIN_BIN = process.env.GBRAIN_BIN || "gbrain";

// PGLite locks the DB process-wide; concurrent `gbrain` subprocesses fight
// for the same lock and starve each other. This queue serializes them all.
let gbrainQueueHead: Promise<void> = Promise.resolve();

function enqueueGbrain<T>(task: () => Promise<T>): Promise<T> {
  const run = gbrainQueueHead.then(task, task) as Promise<T>;
  gbrainQueueHead = run.then(
    () => {},
    () => {},
  );
  return run;
}

async function gbrain(
  args: string[],
  opts?: { timeoutMs?: number },
): Promise<string> {
  return enqueueGbrain(async () => {
    const { stdout } = await exec(GBRAIN_BIN, args, {
      maxBuffer: 32 * 1024 * 1024,
      timeout: opts?.timeoutMs ?? 180_000,
    });
    return stdout.toString();
  });
}

function isTransientGbrainError(msg: string): boolean {
  return (
    /foreign key constraint/i.test(msg) ||
    /UNIQUE constraint/i.test(msg) ||
    /database is locked/i.test(msg) ||
    /Timed out waiting/i.test(msg)
  );
}

function gbrainDetached(args: string[]): void {
  void enqueueGbrain(async () => {
    const run = () =>
      exec(GBRAIN_BIN, args, {
        maxBuffer: 32 * 1024 * 1024,
        timeout: 240_000,
      });
    try {
      await run();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (isTransientGbrainError(msg)) {
        await new Promise((r) => setTimeout(r, 1200));
        try {
          await run();
          return;
        } catch (err2) {
          console.error(
            "[gbrain queued] retry failed:",
            err2 instanceof Error ? err2.message : String(err2),
          );
          return;
        }
      }
      console.error("[gbrain queued] error:", msg);
    }
  });
}

export type PageFrontmatter = {
  type: string;
  slug?: string;
  title?: string;
  tags?: string[];
  [key: string]: unknown;
};

function renderFrontmatter(fm: PageFrontmatter): string {
  const lines: string[] = ["---"];
  for (const [k, v] of Object.entries(fm)) {
    if (v == null) continue;
    if (Array.isArray(v)) {
      lines.push(`${k}:`);
      for (const item of v) lines.push(`  - ${JSON.stringify(item)}`);
    } else if (typeof v === "object") {
      lines.push(`${k}: ${JSON.stringify(v)}`);
    } else {
      lines.push(`${k}: ${JSON.stringify(v)}`);
    }
  }
  lines.push("---", "");
  return lines.join("\n");
}

export async function putPage(
  slug: Slug,
  frontmatter: PageFrontmatter,
  body: string,
): Promise<void> {
  const content = renderFrontmatter(frontmatter) + body;
  await withPageLock(slug, async () => {
    await gbrain(["put", slug, "--content", content]);
  });
}

export function putPageDetached(
  slug: Slug,
  frontmatter: PageFrontmatter,
  body: string,
): void {
  const content = renderFrontmatter(frontmatter) + body;
  gbrainDetached(["put", slug, "--content", content]);
}

export async function getPage(slug: Slug): Promise<string | null> {
  try {
    return await gbrain(["get", slug]);
  } catch {
    return null;
  }
}

export function parseFrontmatter(raw: string): {
  frontmatter: Record<string, unknown>;
  body: string;
} {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { frontmatter: {}, body: raw };
  const fm: Record<string, unknown> = {};
  for (const line of m[1].split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim();
    if (!key) continue;
    try {
      fm[key] = JSON.parse(val);
    } catch {
      fm[key] = val;
    }
  }
  return { frontmatter: fm, body: m[2] };
}

export async function listPages(opts?: {
  type?: string;
  tag?: string;
  limit?: number;
}): Promise<string> {
  const args = ["list"];
  if (opts?.type) args.push("--type", opts.type);
  if (opts?.tag) args.push("--tag", opts.tag);
  if (opts?.limit) args.push("--limit", String(opts.limit));
  return gbrain(args);
}

export async function addTimelineEntry(
  slug: Slug,
  isoDate: string,
  text: string,
): Promise<void> {
  await withPageLock(slug, async () => {
    await gbrain(["timeline-add", slug, isoDate, text]);
  });
}

export async function addLink(
  from: Slug,
  to: Slug,
  type?: string,
): Promise<void> {
  const args = ["link", from, to];
  if (type) args.push("--type", type);
  await gbrain(args);
}

export async function addTag(slug: Slug, tag: string): Promise<void> {
  await gbrain(["tag", slug, tag]);
}

export async function searchGbrain(q: string): Promise<string> {
  return gbrain(["search", q]);
}

export async function queryGbrain(question: string): Promise<string> {
  return gbrain(["query", question]);
}

export async function syncGbrain(): Promise<void> {
  await gbrain(["sync"]);
}

export async function pageExists(slug: Slug): Promise<boolean> {
  return (await getPage(slug)) !== null;
}

export async function upsertWithBody(
  slug: Slug,
  frontmatter: PageFrontmatter,
  buildBody: (existingBody: string | null) => string,
): Promise<void> {
  await withPageLock(slug, async () => {
    const existing = await getPage(slug).catch(() => null);
    let existingBody: string | null = null;
    if (existing) {
      const { body } = parseFrontmatter(existing);
      existingBody = body;
    }
    const content = renderFrontmatter(frontmatter) + buildBody(existingBody);
    await gbrain(["put", slug, "--content", content]);
  });
}
