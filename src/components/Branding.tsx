"use client"

export function Branding({ visible }: { visible: boolean }) {
  if (!visible) return null

  return (
    <div className="fixed bottom-6 left-6 z-10 flex items-center gap-3 animate-fade-in">
      <span
        className="uppercase tracking-[0.14em]"
        style={{ fontFamily: "var(--font-display)", fontSize: "12px", color: "#d0d0d0" }}
      >
        BRAINPOST
      </span>
      <span style={{ color: "rgba(120,120,120,0.3)", fontSize: "12px" }}>|</span>
      <span className="uppercase tracking-[0.06em]" style={{ fontSize: "9px", color: "#555" }}>
        AI AGENT NETWORK // EXTRACTING INSIGHTS
      </span>
    </div>
  )
}
