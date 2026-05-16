"use client";

import { useState } from "react";
import OnboardingFlow from "@/components/OnboardingFlow";
import Dashboard from "@/components/Dashboard";
import type { ScanResult } from "@/types";

export default function Home() {
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);

  if (!scanResult) {
    return <OnboardingFlow onComplete={setScanResult} />;
  }

  return <Dashboard scanResult={scanResult} />;
}
