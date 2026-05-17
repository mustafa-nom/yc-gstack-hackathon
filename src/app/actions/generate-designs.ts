"use server";

import { spawn } from "node:child_process";
import path from "node:path";
import { prepareDesignBrief, type DesignBrief } from "@/lib/handoffs";

export type GenerateDesignsResult = {
  brief: DesignBrief;
  contextLog: string[];
  output: string;
  exitCode: number;
  mocked: boolean;
};

const CAROUSEL_DIR = path.resolve(
  process.cwd(),
  "backend",
  "carousel",
);

export async function generateDesigns(input: {
  niche: string;
}): Promise<GenerateDesignsResult> {
  const brief = await prepareDesignBrief(input);

  if (process.env.RUN_REAL_DESIGN_PIPELINE !== "1") {
    return {
      brief,
      contextLog: brief.contextLog,
      output: [
        "[mock] generate_carousel.py would run with:",
        `  persona: ${brief.personaPath}`,
        `  topics: ${brief.topics.join(", ")}`,
        brief.referencePosts?.length
          ? `  references: ${brief.referencePosts.length} scraped posts`
          : brief.referenceTiktok ? `  account: ${brief.referenceTiktok}` : "",
        "",
        "Set RUN_REAL_DESIGN_PIPELINE=1 to invoke the real pipeline.",
      ]
        .filter(Boolean)
        .join("\n"),
      exitCode: 0,
      mocked: true,
    };
  }

  // Use pre-scraped post URLs if available, otherwise fall back to --account (slower)
  const referenceArgs = brief.referencePosts?.length
    ? brief.referencePosts.flatMap((url) => ["--reference", url])
    : brief.referenceTiktok
    ? ["--account", brief.referenceTiktok]
    : [];

  const args = [
    "generate_carousel.py",
    "--persona",
    brief.personaPath,
    ...referenceArgs,
    ...brief.topics,
  ];

  const { stdout, exitCode } = await runPython(args, CAROUSEL_DIR);
  return { brief, contextLog: brief.contextLog, output: stdout, exitCode, mocked: false };
}

function runPython(
  args: string[],
  cwd: string,
): Promise<{ stdout: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    const child = spawn("python", args, { cwd, env: process.env });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => (stdout += chunk.toString()));
    child.stderr.on("data", (chunk: Buffer) => (stderr += chunk.toString()));
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({
        stdout: stdout + (stderr ? `\n[stderr]\n${stderr}` : ""),
        exitCode: code ?? -1,
      });
    });
  });
}
