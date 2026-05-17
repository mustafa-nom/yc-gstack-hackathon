"use server";

import { ulid } from "ulid";
import { inferIcp, scrapeSite } from "@/lib/agents/icp";
import { kickoffOrchestrator } from "@/lib/orchestrator";
import { writeUserState, type UserState } from "@/lib/state";
import { graphBus } from "@/lib/graph-bus";
import { putPageDetached } from "@/lib/gbrain";

export type OnboardInput = {
  website: string;
  description?: string;
  referenceTiktok?: string;
};

export type OnboardOutput = {
  runId: string;
};

function log(
  runId: string,
  message: string,
  level: "info" | "success" | "warn" | "error" = "info",
  scope?: string,
): void {
  graphBus.publish(runId, {
    kind: "log",
    level,
    message,
    scope,
    ts: new Date().toISOString(),
  });
}

export async function startOnboarding(input: OnboardInput): Promise<OnboardOutput> {
  const runId = ulid();

  log(runId, "Initializing agent pipeline", "info", "system");
  log(runId, `Target: ${input.website}`, "info", "system");

  void (async () => {
    try {
      log(runId, "Crawling product website…", "info", "scrape");
      const siteContent = await scrapeSite(input.website);
      if (siteContent.length === 0) {
        log(runId, "Site fetch returned empty — proceeding with description only", "warn", "scrape");
      } else {
        log(runId, `Captured ${siteContent.length} chars from site`, "success", "scrape");
      }

      log(runId, "Inferring ICP and niches via Claude…", "info", "icp");
      const icp = await inferIcp({
        website: input.website,
        description: input.description,
        websiteContent: siteContent,
      });
      log(
        runId,
        `ICP: ${icp.icp.slice(0, 120)}${icp.icp.length > 120 ? "…" : ""}`,
        "success",
        "icp",
      );
      log(runId, `Niches: ${icp.niches.join(" · ")}`, "success", "icp");

      const personalMd = renderPersonalMd(input, icp);
      const state: UserState = {
        website: input.website,
        description: input.description,
        referenceTiktok: input.referenceTiktok,
        icp: icp.icp,
        niches: icp.niches,
        projectId: process.env.HOG_PROJECT_ID || undefined,
        runId,
        personalMd,
      };
      await writeUserState(state);
      log(runId, "personal.md written to .gpost/", "info", "state");

      if (input.referenceTiktok) {
        putPageDetached("reference-tiktok-account", {
          type: "config",
          title: "Reference TikTok Account",
          tags: ["tiktok", "reference", "style"],
        }, `# Reference TikTok Account\n\n${input.referenceTiktok}\n`);
        log(runId, `Reference account saved to GBrain: ${input.referenceTiktok}`, "info", "state");
      }

      log(runId, `Spinning up ${icp.niches.length} niche workers in parallel`, "info", "orchestrator");
      await kickoffOrchestrator({
        runId,
        niches: icp.niches,
        projectId: state.projectId,
      });
      log(runId, "All niches ready", "success", "orchestrator");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log(runId, `pipeline failed: ${msg}`, "error", "system");
      console.error("[onboarding pipeline] failed:", err);
    }
  })();

  return { runId };
}

function renderPersonalMd(
  input: OnboardInput,
  icp: { icp: string; audience_description: string; pain_points: string[]; seeking: string; niches: string[] },
): string {
  return [
    "# Personal Profile",
    "",
    "## Product",
    `- **Website:** ${input.website}`,
    `- **Description:** ${input.description || "Not provided"}`,
    input.referenceTiktok ? `- **Reference TikTok:** ${input.referenceTiktok}` : "",
    "",
    "## ICP",
    icp.icp,
    "",
    "## Audience",
    icp.audience_description,
    "",
    "**Pain points:**",
    ...icp.pain_points.map((p) => `- ${p}`),
    "",
    `**Seeking:** ${icp.seeking}`,
    "",
    "## Niches",
    ...icp.niches.map((n, i) => `${i + 1}. ${n}`),
    "",
  ]
    .filter(Boolean)
    .join("\n");
}
