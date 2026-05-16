"use client"

import { useEffect, useState } from "react"

interface StatsData {
  agents: number
  insights: number
  trends: number
  confidence: number
  nodes: number
}

export function StatsPanel({ visible }: { visible: boolean }) {
  const [stats, setStats] = useState<StatsData>({
    agents: 0,
    insights: 0,
    trends: 0,
    confidence: 0,
    nodes: 0,
  })

  useEffect(() => {
    if (!visible) return
    const target: StatsData = {
      agents: 8,
      insights: 1247,
      trends: 342,
      confidence: 78,
      nodes: 156,
    }
    const duration = 2000
    const steps = 60
    const interval = duration / steps
    let step = 0
    const timer = setInterval(() => {
      step++
      const t = Math.min(step / steps, 1)
      const ease = 1 - Math.pow(1 - t, 3)
      setStats({
        agents: Math.round(target.agents * ease),
        insights: Math.round(target.insights * ease),
        trends: Math.round(target.trends * ease),
        confidence: Math.round(target.confidence * ease),
        nodes: Math.round(target.nodes * ease),
      })
      if (step >= steps) clearInterval(timer)
    }, interval)
    return () => clearInterval(timer)
  }, [visible])

  if (!visible) return null

  const rows = [
    { label: "ACTIVE AGENTS", value: stats.agents.toString() },
    { label: "INSIGHTS", value: stats.insights.toLocaleString() },
    { label: "TRENDS TRACKED", value: stats.trends.toLocaleString() },
    { label: "AVG CONFIDENCE", value: `${stats.confidence}%` },
    { label: "GRAPH NODES", value: stats.nodes.toString() },
  ]

  return (
    <div
      className="fixed top-6 left-6 z-10 glass-panel rounded-sm px-5 py-4 animate-fade-in"
      style={{ minWidth: 190 }}
    >
      {rows.map((row) => (
        <div
          key={row.label}
          className="flex items-center justify-between py-1.5 border-b last:border-b-0"
          style={{ borderColor: "rgba(120, 120, 120, 0.1)" }}
        >
          <span
            className="uppercase tracking-[0.06em]"
            style={{ fontFamily: "var(--font-display)", fontSize: "9px", color: "#7f8a97" }}
          >
            {row.label}
          </span>
          <span
            className="ml-4 tabular-nums"
            style={{ fontFamily: "var(--font-mono)", fontSize: "13px", color: "#d0d0d0" }}
          >
            {row.value}
          </span>
        </div>
      ))}
    </div>
  )
}
