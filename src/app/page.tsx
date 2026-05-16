"use client";

import { useRouter } from "next/navigation";
import OnboardingFlow from "@/components/OnboardingFlow";
import type { ScanResult } from "@/types";

export default function Home() {
  const router = useRouter();

  return (
    <OnboardingFlow
      onComplete={(data: ScanResult) => {
        localStorage.setItem("scanResult", JSON.stringify(data));
        router.push("/content");
      }}
    />
  );
}
