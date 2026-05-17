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

function NavHeaderInner() {
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

  return (
    <header className="border-b border-card-border relative z-20">
      <div className="max-w-4xl mx-auto px-6 flex items-center justify-between h-14">
        <Link
          href="/"
          className="text-sm font-semibold tracking-tight text-foreground/80 hover:text-foreground transition-colors"
        >
          GPost
        </Link>
        <nav className="flex gap-1">
          {TABS.map(({ href, label }) => (
            <Link
              key={href}
              href={`${href}${suffix}`}
              className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                pathname === href
                  ? "text-foreground bg-subtle"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

export default function NavHeader() {
  return (
    <Suspense fallback={<div className="h-14 border-b border-card-border" />}>
      <NavHeaderInner />
    </Suspense>
  );
}
