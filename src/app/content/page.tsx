import Link from "next/link";
import ContentStudio from "@/components/ContentStudio";
import NavHeader from "@/components/NavHeader";
import { loadPerformanceFixture } from "@/app/actions/performance";
import type { StrategyData } from "@/types";

export default async function ContentPage() {
  const rows = await loadPerformanceFixture();
  const latest = rows[0]?.carousel;

  if (!latest) {
    return (
      <div className="min-h-screen flex flex-col">
        <NavHeader />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-muted text-sm mb-4">No carousels generated yet.</p>
            <Link
              href="/"
              className="text-accent text-sm hover:underline"
            >
              Start an onboarding run →
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const strategy: StrategyData = {
    hookPattern: latest.hook,
    slideStructure: `${latest.slides.length}-slide ${latest.archetype}`,
    ctaStyle: "Save + share",
    nicheScore: 8.4,
  };

  return (
    <div className="min-h-screen flex flex-col">
      <NavHeader />
      <main className="flex-1 relative z-10">
        <div className="max-w-4xl mx-auto px-6 py-12">
          <ContentStudio strategy={strategy} />
        </div>
      </main>
    </div>
  );
}
