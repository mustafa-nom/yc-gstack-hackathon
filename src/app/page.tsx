"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import OnboardingFlow from "@/components/OnboardingFlow";

export default function Home() {
  useEffect(() => {
    const lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);
    return () => lenis.destroy();
  }, []);

  return <OnboardingFlow />;
}
