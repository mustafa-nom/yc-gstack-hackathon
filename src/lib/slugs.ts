export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

export function nicheSlugFromName(name: string): string {
  return slugify(name);
}

export function creatorSlugFromHandle(handle: string): string {
  const clean = handle
    .replace(/^@/, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.-]/g, "");
  return `@${clean || "unknown"}`;
}

export function archetypeSlug(archetype: string): string {
  return slugify(archetype || "general");
}
