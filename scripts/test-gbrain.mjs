import {
  putPage,
  getPage,
  upsertWithBody,
  parseFrontmatter,
} from "../src/lib/gbrain.ts";

const slug = "niches/ts-roundtrip-test";

await putPage(
  slug,
  { type: "niche", slug: "ts-roundtrip-test", title: "TS Roundtrip Test" },
  `## Compiled truth
Hello from TS client.

## Timeline
`,
);

const raw = await getPage(slug);
console.log("---raw page---");
console.log(raw);

const parsed = parseFrontmatter(raw ?? "");
console.log("---parsed frontmatter---");
console.log(parsed.frontmatter);

await upsertWithBody(
  slug,
  { type: "niche", slug: "ts-roundtrip-test", title: "TS Roundtrip Test" },
  (existing) => (existing ?? "") + `- 2026-05-16T16:00: appended via upsertWithBody\n`,
);

const after = await getPage(slug);
console.log("---after append---");
console.log(after);
