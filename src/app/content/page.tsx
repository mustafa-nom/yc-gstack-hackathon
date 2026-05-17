import Link from "next/link";
import ContentStudio from "@/components/ContentStudio";
import NavHeader from "@/components/NavHeader";
import { readUserState } from "@/lib/state";
import type { StrategyData } from "@/types";

export const dynamic = "force-dynamic";

export default async function ContentPage() {
  const state = await readUserState();

  if (!state || !state.niches?.length) {
    return (
      <div className="min-h-screen flex flex-col">
        <NavHeader />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-muted text-sm mb-4">
              No onboarding run found. Start one to generate carousels.
            </p>
            <Link href="/" className="text-accent text-sm hover:underline">
              Go to onboarding →
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const strategy: StrategyData = {
    hookPattern: state.niches[0],
    slideStructure: "5-slide carousel",
    ctaStyle: "Save + share",
    nicheScore: 8.4,
  };

  const persona = {
    icp: state.icp,
    niches: state.niches,
  };

  return (
    <div className="min-h-screen flex flex-col">
      <NavHeader />
      <main className="flex-1 relative z-10">
        <ContentStudio strategy={strategy} persona={persona} />
      </main>
    </div>
  );
}
