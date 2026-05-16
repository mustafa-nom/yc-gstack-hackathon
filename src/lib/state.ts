import { promises as fs } from "node:fs";
import path from "node:path";

const BASE = path.resolve(process.cwd(), ".brainpost");

async function ensure(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
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
  const full = path.join(BASE, rel);
  await ensure(path.dirname(full));
  await fs.writeFile(full, JSON.stringify(data, null, 2), "utf-8");
}

export async function readJson<T>(rel: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(path.join(BASE, rel), "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function listJson(relDir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(path.join(BASE, relDir));
    return entries.filter((e) => e.endsWith(".json"));
  } catch {
    return [];
  }
}

export function brainpostPath(rel: string): string {
  return path.join(BASE, rel);
}
