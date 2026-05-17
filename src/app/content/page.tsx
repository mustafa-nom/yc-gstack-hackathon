import Link from "next/link";
import ContentStudio from "@/components/ContentStudio";
import NavHeader from "@/components/NavHeader";
import { loadLatestStrategyView } from "@/app/actions/strategy";

export const dynamic = "force-dynamic";

export default async function ContentPage() {
  const view = await loadLatestStrategyView();

  if (!view) {
    return (
      <div className="min-h-screen flex flex-col">
        <NavHeader />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-muted text-sm mb-4">
              No strategy synthesized yet — run onboarding first.
            </p>
            <Link href="/" className="text-accent text-sm hover:underline">
              Start an onboarding run →
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <NavHeader />
      <main className="flex-1 relative z-10">
        <div className="max-w-4xl mx-auto px-6 py-12">
          <ContentStudio
            strategy={view.legacy}
            view={view}
            persona={view.persona ?? undefined}
          />
        </div>
      </main>
    </div>
  );
}
