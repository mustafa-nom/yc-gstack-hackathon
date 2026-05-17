import { promises as fs } from "node:fs";
import path from "node:path";

const BASE = path.resolve(process.cwd(), ".brainpost");

async function ensure(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

// Resolve `rel` against BASE and reject anything that escapes the directory.
// path.join does not block "../" — only path.resolve + a prefix check does.
function resolveSafe(rel: string): string {
  const full = path.resolve(BASE, rel);
  if (full !== BASE && !full.startsWith(BASE + path.sep)) {
    throw new Error(`path traversal blocked: ${rel}`);
  }
  return full;
}

export type UserState = {
  website: string;
  description?: string;
  referenceTiktok?: string;
  icp?: string;
  niches?: string[];
  projectId?: string;
  runId?: string;
  personalMd?: string;
};

export async function readUserState(): Promise<UserState | null> {
  try {
    const raw = await fs.readFile(path.join(BASE, "user.json"), "utf-8");
    return JSON.parse(raw) as UserState;
  } catch {
    return null;
  }
}

export async function writeUserState(state: UserState): Promise<void> {
  await ensure(BASE);
  await fs.writeFile(
    path.join(BASE, "user.json"),
    JSON.stringify(state, null, 2),
    "utf-8",
  );
  if (state.personalMd) {
    await fs.writeFile(path.join(BASE, "personal.md"), state.personalMd, "utf-8");
  }
}

export async function writeJson(rel: string, data: unknown): Promise<void> {
  const full = resolveSafe(rel);
  await ensure(path.dirname(full));
  await fs.writeFile(full, JSON.stringify(data, null, 2), "utf-8");
}

export async function readJson<T>(rel: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(resolveSafe(rel), "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function listJson(relDir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(resolveSafe(relDir));
    return entries.filter((e) => e.endsWith(".json"));
  } catch {
    return [];
  }
}

export function brainpostPath(rel: string): string {
  return resolveSafe(rel);
}
