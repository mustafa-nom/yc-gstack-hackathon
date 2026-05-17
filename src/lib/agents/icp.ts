import { generateText, Output } from "ai";
import { z } from "zod";
import { getAgentModel } from "./model";

const IcpSchema = z.object({
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
    .min(3)
    .max(3)
    .describe(
      "Exactly 3 specific TikTok niches that fit this product, each 2-5 words",
    ),
});

export type IcpOutput = z.infer<typeof IcpSchema>;

export async function inferIcp(input: {
  website: string;
  description?: string;
  websiteContent?: string;
}): Promise<IcpOutput> {
  const promptParts = [
    `Product website: ${input.website}`,
    input.description ? `User description: ${input.description}` : "",
    input.websiteContent
      ? `Scraped site content (truncated):\n${input.websiteContent.slice(0, 3000)}`
      : "",
    "",
    "Infer the ICP and propose exactly 3 TikTok niches where this product could win.",
    "Niches should be specific: not 'fitness' but 'time-constrained intermediate lifters', not 'finance' but 'first-job personal finance for new grads'.",
  ].filter(Boolean);

  const { experimental_output: output } = await generateText({
    model: getAgentModel("icp"),
    experimental_output: Output.object({ schema: IcpSchema }),
    system:
      "You are a TikTok growth strategist. Given a product, you infer the ICP and propose specific niches where the product fits TikTok's algorithm and audience taste.",
    prompt: promptParts.join("\n"),
  });

  return output as IcpOutput;
}

// Block fetches to internal-network addresses to neutralize SSRF when the
// website URL ultimately comes from user input.
function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h === "0.0.0.0" || h === "::1" || h === "::") return true;
  if (h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) return true;
  // IPv4 dotted ranges
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const [a, b] = [parseInt(m[1], 10), parseInt(m[2], 10)];
    if (a === 10) return true;                          // 10.0.0.0/8
    if (a === 127) return true;                         // loopback
    if (a === 169 && b === 254) return true;            // link-local incl. AWS metadata
    if (a === 172 && b >= 16 && b <= 31) return true;   // 172.16.0.0/12
    if (a === 192 && b === 168) return true;            // 192.168.0.0/16
    if (a === 100 && b >= 64 && b <= 127) return true;  // CGNAT
    if (a === 0) return true;                           // 0.0.0.0/8
  }
  // IPv6 loopback / link-local / unique-local prefixes
  if (h.startsWith("fe80:") || h.startsWith("fc") || h.startsWith("fd")) return true;
  return false;
}

export async function scrapeSite(url: string): Promise<string> {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      console.warn(`[scrapeSite] rejected non-http scheme: ${parsed.protocol}`);
      return "";
    }
    if (isBlockedHost(parsed.hostname)) {
      console.warn(`[scrapeSite] rejected internal host: ${parsed.hostname}`);
      return "";
    }
    const res = await fetch(parsed.toString(), {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(15_000),
      redirect: "manual",
    });
    if (res.status >= 300 && res.status < 400) {
      // Manual redirect handling so we can re-validate the target host.
      const loc = res.headers.get("location");
      if (!loc) return "";
      const next = new URL(loc, parsed);
      if (isBlockedHost(next.hostname)) {
        console.warn(`[scrapeSite] rejected redirect to internal host: ${next.hostname}`);
        return "";
      }
      return scrapeSite(next.toString());
    }
    const html = await res.text();
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 4000);
  } catch (err) {
    console.warn(`[scrapeSite] ${url}: ${err instanceof Error ? err.message : String(err)}`);
    return "";
  }
}
