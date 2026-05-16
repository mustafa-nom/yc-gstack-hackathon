import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

export type AgentTask = "icp" | "synthesize";

const DEFAULTS = {
  anthropic: {
    icp: "claude-opus-4-7",
    synthesize: "claude-opus-4-7",
  },
  openai: {
    icp: "gpt-4o",
    synthesize: "gpt-4o",
  },
} as const;

// Picks Anthropic if ANTHROPIC_API_KEY is set, else OpenAI.
// Override the model per task with <TASK>_MODEL (must match the selected provider).
export function getAgentModel(task: AgentTask): LanguageModel {
  const override = process.env[`${task.toUpperCase()}_MODEL`];
  if (process.env.ANTHROPIC_API_KEY) {
    return anthropic(override ?? DEFAULTS.anthropic[task]);
  }
  if (process.env.OPENAI_API_KEY) {
    return openai(override ?? DEFAULTS.openai[task]);
  }
  throw new Error(
    "No model provider configured: set ANTHROPIC_API_KEY or OPENAI_API_KEY in .env",
  );
}
