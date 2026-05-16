import PerformanceLoop from "@/components/PerformanceLoop";
import NavHeader from "@/components/NavHeader";

export default function PerformancePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <NavHeader />
      <main className="flex-1">
        <div className="max-w-4xl mx-auto px-6 py-12">
          <PerformanceLoop />
        </div>
      </main>
    </div>
  );
}
