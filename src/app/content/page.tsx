"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import NavHeader from "@/components/NavHeader";
import ContentStudio from "@/components/ContentStudio";
import type { ScanResult } from "@/types";

export default function ContentPage() {
  const router = useRouter();
  const [scanResult] = useState<ScanResult | null>(() => {
    if (typeof window === "undefined") return null;
    const raw = localStorage.getItem("scanResult");
    return raw ? (JSON.parse(raw) as ScanResult) : null;
  });

  useEffect(() => {
    if (!scanResult) router.replace("/");
  }, [scanResult, router]);

  return (
    <div className="min-h-screen flex flex-col">
      <NavHeader />
      <main className="flex-1 relative z-10">
        <div className="max-w-4xl mx-auto px-6 py-12">
          <AnimatePresence mode="wait">
            {scanResult && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              >
                <ContentStudio strategy={scanResult.strategy} slides={scanResult.slides} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
