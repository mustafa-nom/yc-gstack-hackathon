"use client"

import { useState } from "react"

interface LandingOverlayProps {
  onInitialize: () => void
}

export function LandingOverlay({ onInitialize }: LandingOverlayProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [isFading, setIsFading] = useState(false)
  const [status, setStatus] = useState("NETWORK STAGED. INITIALIZE WHEN READY.")

  const handleInit = () => {
    setIsLoading(true)
    setStatus("INITIALIZING AGENT MESH...")
    setTimeout(() => setStatus("MAPPING KNOWLEDGE NODES..."), 600)
    setTimeout(() => setStatus("DEPLOYING TIKTOK SCRAPERS..."), 1200)
    setTimeout(() => {
      setStatus("NETWORK ONLINE.")
      setIsFading(true)
      setTimeout(() => onInitialize(), 700)
    }, 1800)
  }

  return (
    <div
      className={`fixed inset-0 z-[120] flex items-center justify-center transition-opacity duration-700 ${
        isFading ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
      style={{ background: "#07080b" }}
    >
      <div className="flex flex-col items-center text-center px-6" style={{ width: "min(92vw, 760px)" }}>
        <h1
          className="font-bold tracking-[0.12em] uppercase"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(48px, 10vw, 110px)",
            lineHeight: 0.95,
            color: "#d4d8de",
            textShadow: "0 0 26px rgba(186, 198, 214, 0.2)",
          }}
        >
          BRAINPOST
        </h1>
        <p
          className="mt-3 uppercase tracking-[0.09em]"
          style={{
            fontFamily: "var(--font-display)",
            color: "#7f8a97",
            fontSize: "clamp(12px, 2.3vw, 16px)",
          }}
        >
          THE AI AGENT NETWORK FOR TIKTOK INSIGHTS.
        </p>
        <button
          onClick={handleInit}
          disabled={isLoading}
          className="mt-8 px-7 py-3 uppercase tracking-[0.11em] text-sm cursor-pointer transition-all duration-200 disabled:opacity-60 disabled:cursor-wait hover:border-[rgba(210,224,244,0.72)] hover:bg-[rgba(25,29,36,0.92)] hover:text-[#dae8f7] active:scale-[0.97]"
          style={{
            fontFamily: "var(--font-display)",
            border: "1px solid rgba(172, 189, 210, 0.55)",
            background: "rgba(16, 18, 23, 0.9)",
            color: "#c2d1e0",
            fontSize: "14px",
          }}
        >
          INITIALIZE NETWORK
        </button>
        <p
          className="mt-4 uppercase tracking-[0.07em] min-h-[18px]"
          style={{ color: "#6f7884", fontSize: "11px" }}
        >
          {status}
        </p>
      </div>
    </div>
  )
}
