"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useSyncExternalStore } from "react";
import {
  getStoredRunId,
  setStoredRunId,
  subscribeStoredRunId,
} from "@/lib/run-context";

const TABS = [
  { href: "/graph", label: "Graph" },
  { href: "/content", label: "Content" },
  { href: "/performance", label: "Performance" },
] as const;

type Variant = "header" | "floating";

function NavTabsInner({ variant }: { variant: Variant }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const urlRunId = params.get("runId");
  const storedRunId = useSyncExternalStore(
    subscribeStoredRunId,
    getStoredRunId,
    () => null,
  );

  useEffect(() => {
    if (urlRunId) setStoredRunId(urlRunId);
  }, [urlRunId]);

  const runId = urlRunId ?? storedRunId;
  const suffix = runId ? `?runId=${encodeURIComponent(runId)}` : "";

  const containerClass =
    variant === "floating"
      ? "pointer-events-auto bg-card-bg/80 border border-card-border rounded backdrop-blur-sm flex gap-0.5 p-0.5"
      : "flex gap-1";

  return (
    <nav className={containerClass}>
      {TABS.map(({ href, label }) => {
        const isActive = pathname === href;
        if (variant === "floating") {
          return (
            <Link
              key={href}
              href={`${href}${suffix}`}
              className={`px-2.5 py-1 rounded text-[10px] font-mono uppercase tracking-widest transition-colors ${
                isActive
                  ? "bg-subtle text-foreground"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {label}
            </Link>
          );
        }
        return (
          <Link
            key={href}
            href={`${href}${suffix}`}
            className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
              isActive
                ? "text-foreground bg-subtle"
                : "text-muted hover:text-foreground"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export default function NavTabs({
  variant = "header",
}: {
  variant?: Variant;
}) {
  return (
    <Suspense fallback={null}>
      <NavTabsInner variant={variant} />
    </Suspense>
  );
}
