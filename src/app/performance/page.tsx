"use client";

import { motion } from "motion/react";
import NavHeader from "@/components/NavHeader";
import ContentCalendar from "@/components/ContentCalendar";

export default function PerformancePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <NavHeader />
      <main className="flex-1">
        <div className="max-w-4xl mx-auto px-6 py-12">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          >
            <ContentCalendar />
          </motion.div>
        </div>
      </main>
    </div>
  );
}
