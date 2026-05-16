import PerformanceLoop from "@/components/PerformanceLoop";
import Link from "next/link";

export default function PerformancePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-card-border">
        <div className="max-w-4xl mx-auto px-6 flex items-center justify-between h-14">
          <Link
            href="/"
            className="text-sm font-semibold tracking-tight text-foreground/80 hover:text-foreground"
          >
            BrainPost
          </Link>
          <nav className="flex gap-1 text-sm">
            <Link
              href="/"
              className="px-3 py-1.5 rounded-md text-muted hover:text-foreground transition-colors"
            >
              Home
            </Link>
            <span className="px-3 py-1.5 rounded-md text-foreground bg-subtle">
              Performance
            </span>
          </nav>
        </div>
      </header>
      <main className="flex-1">
        <div className="max-w-4xl mx-auto px-6 py-12">
          <PerformanceLoop />
        </div>
      </main>
    </div>
  );
}
