import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { graphBus, type GraphEvent } from "./graph-bus";

export type LogLevel = "info" | "success" | "warn" | "error";

export type StepLogEntry = {
  ts: string;
  runId: string;
  step: string;
  level: LogLevel;
  message: string;
  source: "ui" | "server";
};

const LOG_ROOT = path.join(process.cwd(), ".gpost", "logs");

function safeSlug(s: string): string {
  return s.replace(/[^a-z0-9._-]+/gi, "-").toLowerCase().slice(0, 80) || "step";
}

function format(entry: StepLogEntry): string {
  return `${entry.ts} [${entry.level.toUpperCase()}] [${entry.source}] [${entry.step}] ${entry.message}\n`;
}

async function appendFile(file: string, line: string): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.appendFile(file, line, "utf8");
}

export async function appendLog(entry: Omit<StepLogEntry, "ts"> & { ts?: string }): Promise<void> {
  const full: StepLogEntry = {
    ts: entry.ts ?? new Date().toISOString(),
    runId: entry.runId,
    step: entry.step,
    level: entry.level,
    message: entry.message,
    source: entry.source,
  };
  const line = format(full);
  const runDir = path.join(LOG_ROOT, safeSlug(full.runId));
  await Promise.all([
    appendFile(path.join(runDir, "run.log"), line),
    appendFile(path.join(runDir, "steps", `${safeSlug(full.step)}.log`), line),
  ]);
}

function stepFromEvent(e: GraphEvent): { step: string; level: LogLevel; message: string } | null {
  switch (e.kind) {
    case "log":
      return {
        step: e.scope ?? "orchestrator",
        level: e.level,
        message: e.message,
      };
    case "phaseDone":
      return {
        step: `${e.niche}:${e.phase}`,
        level: "success",
        message: `phase ${e.phase} done`,
      };
    case "nicheReady":
      return { step: e.niche, level: "success", message: "niche ready" };
    case "allReady":
      return { step: "orchestrator", level: "success", message: "all niches ready" };
    case "error":
      return {
        step: e.niche ?? "orchestrator",
        level: "error",
        message: e.message,
      };
    default:
      return null;
  }
}

const attached = new Set<string>();

export function attachStepLogger(runId: string): () => void {
  if (attached.has(runId)) return () => {};
  attached.add(runId);

  const unsubscribe = graphBus.subscribe(runId, (event) => {
    const mapped = stepFromEvent(event);
    if (!mapped) return;
    void appendLog({
      runId,
      step: mapped.step,
      level: mapped.level,
      message: mapped.message,
      source: "server",
    }).catch(() => {
      // disk errors should never break the orchestrator
    });
  });

  void appendLog({
    runId,
    step: "orchestrator",
    level: "info",
    message: "logger attached",
    source: "server",
  }).catch(() => {});

  return () => {
    unsubscribe();
    attached.delete(runId);
  };
}
