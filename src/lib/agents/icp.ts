import { generateText, Output } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";

function buildIcpSchema(nicheCount: number) {
  return z.object({
    icp: z
      .string()
      .describe(
        "2-3 sentence ICP description: who they are, what they care about, what they're trying to do",
      ),
    audience_description: z
      .string()
      .describe("Audience description suitable for a brand brief"),
    pain_points: z.array(z.string()).min(2).max(5),
    seeking: z.string().describe("What this audience is seeking from content"),
    niches: z
      .array(z.string())
      .min(nicheCount)
      .max(nicheCount)
      .describe(
        `Exactly ${nicheCount} specific TikTok niches that fit this product, each 2-5 words`,
      ),
  });
}

export type IcpOutput = {
  icp: string;
  audience_description: string;
  pain_points: string[];
  seeking: string;
  niches: string[];
};

const ICP_MODEL = process.env.ICP_MODEL ?? "claude-opus-4-7";

export async function inferIcp(input: {
  website: string;
  description?: string;
  websiteContent?: string;
  nicheCount?: number;
}): Promise<IcpOutput> {
  const nicheCount = Math.max(1, Math.min(20, input.nicheCount ?? 5));
  const promptParts = [
    `Product website: ${input.website}`,
    input.description ? `User description: ${input.description}` : "",
    input.websiteContent
      ? `Scraped site content (truncated):\n${input.websiteContent.slice(0, 3000)}`
      : "",
    "",
    `Infer the ICP and propose exactly ${nicheCount} TikTok niches where this product could win.`,
    "Niches should be specific: not 'fitness' but 'time-constrained intermediate lifters', not 'finance' but 'first-job personal finance for new grads'.",
  ].filter(Boolean);

  const { experimental_output: output } = await generateText({
    model: anthropic(ICP_MODEL),
    experimental_output: Output.object({ schema: buildIcpSchema(nicheCount) }),
    system:
      "You are a TikTok growth strategist. Given a product, you infer the ICP and propose specific niches where the product fits TikTok's algorithm and audience taste.",
    prompt: promptParts.join("\n"),
  });

  return output as IcpOutput;
}

export async function scrapeSite(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(15_000),
    });
    const html = await res.text();
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 4000);
  } catch {
    return "";
  }
}
