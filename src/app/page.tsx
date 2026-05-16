"use client";

import { useState, useEffect } from "react";
import Lenis from "lenis";
import OnboardingFlow from "@/components/OnboardingFlow";
import Dashboard from "@/components/Dashboard";
import type { ScanResult } from "@/types";

export default function Home() {
  const [phase, setPhase] = useState<"onboarding" | "dashboard">("onboarding");
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);

  useEffect(() => {
    const lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);
    return () => lenis.destroy();
  }, []);

  if (phase === "onboarding") {
    return (
      <OnboardingFlow
        onComplete={(data: ScanResult) => {
          setScanResult(data);
          setPhase("dashboard");
        }}
      />
    );
  }

  return <Dashboard scanResult={scanResult!} />;
}
