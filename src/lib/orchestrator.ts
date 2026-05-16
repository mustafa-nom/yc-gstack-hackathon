import { runNicheIngestion, type NicheRunResult } from "./hog/worker";
import { graphBus } from "./graph-bus";

export type OrchestrationInput = {
  runId: string;
  niches: string[];
  projectId?: string;
};

export type OrchestrationResult = {
  runId: string;
  results: NicheRunResult[];
};

export async function runOrchestrator(
  input: OrchestrationInput,
): Promise<OrchestrationResult> {
  const { runId, niches, projectId } = input;

  const workers = niches.map((niche, i) =>
    runNicheIngestion({ runId, niche, group: i, projectId }).catch((err) => ({
      niche,
      nicheSlug: niche,
      degraded: true,
      error: err instanceof Error ? err.message : String(err),
    } satisfies NicheRunResult)),
  );

  const results = await Promise.all(workers);

  graphBus.publish(runId, { kind: "allReady" });

  return { runId, results };
}

const inflight = new Map<string, Promise<OrchestrationResult>>();

export function kickoffOrchestrator(
  input: OrchestrationInput,
): Promise<OrchestrationResult> {
  const existing = inflight.get(input.runId);
  if (existing) return existing;
  const p = runOrchestrator(input);
  inflight.set(input.runId, p);
  return p;
}
