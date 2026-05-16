"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/content", label: "Content" },
  { href: "/performance", label: "Performance" },
  { href: "/knowledge-graph", label: "Knowledge Graph" },
] as const;

export default function NavHeader() {
  const pathname = usePathname();

  return (
    <header className="border-b border-card-border relative z-20">
      <div className="max-w-4xl mx-auto px-6 flex items-center justify-between h-14">
        <Link href="/content" className="text-sm font-semibold tracking-tight text-foreground/80">
          BrainPost
        </Link>
        <nav className="flex gap-1">
          {TABS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
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
