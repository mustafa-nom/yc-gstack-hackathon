"use client"

import { useEffect, useState, useRef } from "react"

interface AgentViewerProps {
  node: {
    id: string
    name: string
    type: "agent" | "insight" | "trend"
    confidence?: number
    domain?: string
  } | null
  onClose: () => void
}

const TIKTOK_POSTS = [
  { handle: "@marketingguru", desc: "5 hooks that tripled my engagement", likes: "245K", tags: ["#marketing", "#viral"] },
  { handle: "@contentking", desc: "Why short form > long form in 2026", likes: "189K", tags: ["#content", "#growth"] },
  { handle: "@brandbuilder", desc: "This ONE trick brands don't want you to know", likes: "412K", tags: ["#branding", "#secret"] },
  { handle: "@trendspotter", desc: "POV: You find the next big niche before everyone", likes: "98K", tags: ["#niche", "#early"] },
  { handle: "@growthhack", desc: "I went from 0 to 100K in 30 days. Here is how.", likes: "567K", tags: ["#growth", "#tutorial"] },
  { handle: "@viralcoach", desc: "The algorithm changed AGAIN. New strategy:", likes: "334K", tags: ["#algorithm", "#update"] },
  { handle: "@socialwiz", desc: "Stop making content. Start making movements.", likes: "278K", tags: ["#movement", "#brand"] },
  { handle: "@tiktoktips", desc: "3 sounds trending RIGHT NOW for your niche", likes: "156K", tags: ["#sounds", "#trending"] },
  { handle: "@datanerd", desc: "I analyzed 10K viral posts. Pattern found.", likes: "891K", tags: ["#data", "#analysis"] },
  { handle: "@aimarketer", desc: "Using AI to find trends before they peak", likes: "203K", tags: ["#ai", "#trends"] },
  { handle: "@nichefinder", desc: "The underrated niches blowing up in Q2", likes: "145K", tags: ["#niche", "#opportunity"] },
  { handle: "@hookmaster", desc: "Your first 3 seconds decide everything", likes: "677K", tags: ["#hooks", "#retention"] },
]

const INSIGHTS = [
  "Hook pattern detected: question-based openings +34% engagement",
  "Trend signal: AI-generated content gaining 2.3x more shares",
  "Niche opportunity: sustainable tech content underserved",
  "Algorithm shift: longer watch time now weighted 1.8x vs likes",
  "Sound trend: ambient beats correlated with higher completion rate",
  "Posting window: 6-8PM EST showing 47% higher initial reach",
  "Format signal: split-screen comparisons up 89% this week",
  "Hashtag cluster: #deinfluencing gaining momentum rapidly",
  "Audience signal: 25-34 demo engaging more with educational content",
  "Cross-platform: TikTok trends appearing on Reels 3-5 days later",
]

export function AgentViewer({ node, onClose }: AgentViewerProps) {
  const [logs, setLogs] = useState<string[]>([])
  const [currentPost, setCurrentPost] = useState(0)
  const [extractedInsights, setExtractedInsights] = useState<string[]>([])
  const [phase, setPhase] = useState<"scanning" | "extracting" | "complete">("scanning")
  const logsRef = useRef<HTMLDivElement>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!node) return

    const addLog = (msg: string) => {
      setLogs((prev) => [...prev.slice(-30), msg])
    }

    addLog(`> Agent ${node.name} activated`)
    addLog(`> Connecting to TikTok feed...`)
    addLog(`> Target domain: ${node.domain || "general"}`)
    addLog(`> Scanning initiated`)
    addLog(``)

    let postIdx = 0
    let insightIdx = 0

    intervalRef.current = setInterval(() => {
      if (postIdx < 8) {
        const post = TIKTOK_POSTS[postIdx % TIKTOK_POSTS.length]
        addLog(`[SCAN] ${post.handle}: "${post.desc}"`)
        addLog(`       ${post.likes} likes | ${post.tags.join(" ")}`)
        setCurrentPost(postIdx)

        if (postIdx > 1 && postIdx % 2 === 0 && insightIdx < 5) {
          setTimeout(() => {
            const insight = INSIGHTS[insightIdx % INSIGHTS.length]
            addLog(`[INSIGHT] ${insight}`)
            setExtractedInsights((prev) => [...prev, insight])
            insightIdx++
          }, 400)
        }

        postIdx++
      } else if (insightIdx < 5) {
        setPhase("extracting")
        const insight = INSIGHTS[insightIdx % INSIGHTS.length]
        addLog(`[EXTRACT] Synthesizing: ${insight}`)
        setExtractedInsights((prev) => [...prev, insight])
        insightIdx++
      } else {
        setPhase("complete")
        addLog(``)
        addLog(`> Scan complete. ${insightIdx} insights extracted.`)
        addLog(`> Confidence: ${node.confidence ?? 78}%`)
        if (intervalRef.current) clearInterval(intervalRef.current)
      }
    }, 900)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [node])

  useEffect(() => {
    if (logsRef.current) {
      logsRef.current.scrollTop = logsRef.current.scrollHeight
    }
  }, [logs])

  if (!node) return null

  const confidenceColor =
    (node.confidence ?? 78) > 70 ? "#8baa8b" : (node.confidence ?? 78) > 40 ? "#bfb080" : "#c45050"

  return (
    <div className="fixed right-6 top-20 bottom-6 z-20 w-[420px] glass-panel rounded-sm flex flex-col overflow-hidden animate-fade-in">
      <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "rgba(120,120,120,0.15)" }}>
        <div>
          <div className="flex items-center gap-2">
            <div
              className="w-2 h-2 rounded-full"
              style={{
                background: phase === "complete" ? "#8baa8b" : "#d0d0d0",
                boxShadow: phase !== "complete" ? "0 0 6px rgba(200,200,200,0.5)" : undefined,
                animation: phase !== "complete" ? "pulse-ring 1.5s infinite" : undefined,
              }}
            />
            <h2
              className="uppercase tracking-[0.08em]"
              style={{ fontFamily: "var(--font-display)", fontSize: "12px", color: "#d0d0d0" }}
            >
              {node.name}
            </h2>
          </div>
          <p className="mt-1 uppercase tracking-[0.06em]" style={{ fontSize: "9px", color: "#7f8a97" }}>
            {(node.domain || "GENERAL").toUpperCase()} / {node.type.toUpperCase()}
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-lg leading-none hover:text-[#d0d0d0] transition-colors cursor-pointer"
          style={{ color: "#555", fontFamily: "var(--font-mono)" }}
        >
          x
        </button>
      </div>

      <div className="px-5 py-3 border-b" style={{ borderColor: "rgba(120,120,120,0.15)" }}>
        <div className="flex items-center justify-between mb-1.5">
          <span className="uppercase tracking-[0.06em]" style={{ fontFamily: "var(--font-display)", fontSize: "9px", color: "#7f8a97" }}>
            CONFIDENCE
          </span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: confidenceColor }}>
            {node.confidence ?? 78}%
          </span>
        </div>
        <div className="w-full h-1 rounded-full" style={{ background: "rgba(120,120,120,0.2)" }}>
          <div
            className="h-full rounded-full transition-all duration-1000 ease-out"
            style={{
              width: `${node.confidence ?? 78}%`,
              background: confidenceColor,
              boxShadow: `0 0 8px ${confidenceColor}40`,
            }}
          />
        </div>
      </div>

      <div className="px-5 py-3 border-b flex-shrink-0" style={{ borderColor: "rgba(120,120,120,0.15)" }}>
        <span className="uppercase tracking-[0.06em] block mb-2" style={{ fontFamily: "var(--font-display)", fontSize: "9px", color: "#7f8a97" }}>
          LIVE FEED SCAN
        </span>
        <div className="space-y-2 max-h-[140px] overflow-hidden relative">
          {TIKTOK_POSTS.slice(Math.max(0, currentPost - 2), currentPost + 1).map((post, i) => (
            <div
              key={`${post.handle}-${i}`}
              className="rounded-sm p-2.5 animate-slide-up"
              style={{
                background: i === Math.min(currentPost, 2) ? "rgba(160,160,160,0.08)" : "rgba(120,120,120,0.04)",
                border: i === Math.min(currentPost, 2) ? "1px solid rgba(160,160,160,0.15)" : "1px solid transparent",
              }}
            >
              <div className="flex items-center justify-between">
                <span style={{ fontSize: "11px", color: "#d0d0d0" }}>{post.handle}</span>
                <span style={{ fontSize: "9px", color: "#7f8a97" }}>{post.likes}</span>
              </div>
              <p className="mt-0.5" style={{ fontSize: "10px", color: "#888" }}>{post.desc}</p>
              <div className="flex gap-1.5 mt-1">
                {post.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-1.5 py-0.5 rounded-sm"
                    style={{ fontSize: "8px", color: "#8baa8b", background: "rgba(139,170,139,0.1)" }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ))}
          {phase === "scanning" && (
            <div className="absolute bottom-0 left-0 right-0 h-8" style={{ background: "linear-gradient(to top, var(--panel-bg), transparent)" }} />
          )}
        </div>
      </div>

      {extractedInsights.length > 0 && (
        <div className="px-5 py-3 border-b flex-shrink-0" style={{ borderColor: "rgba(120,120,120,0.15)" }}>
          <span className="uppercase tracking-[0.06em] block mb-2" style={{ fontFamily: "var(--font-display)", fontSize: "9px", color: "#7f8a97" }}>
            EXTRACTED INSIGHTS ({extractedInsights.length})
          </span>
          <div className="space-y-1.5 max-h-[100px] overflow-y-auto">
            {extractedInsights.map((insight, i) => (
              <div key={i} className="flex items-start gap-2 animate-fade-in">
                <span style={{ color: "#8baa8b", fontSize: "10px", flexShrink: 0, marginTop: 2 }}>+</span>
                <span style={{ fontSize: "10px", color: "#b8b8b8", lineHeight: 1.4 }}>{insight}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 min-h-0 flex flex-col">
        <div className="px-5 pt-3 pb-1">
          <span className="uppercase tracking-[0.06em]" style={{ fontFamily: "var(--font-display)", fontSize: "9px", color: "#7f8a97" }}>
            AGENT LOG
          </span>
        </div>
        <div ref={logsRef} className="flex-1 overflow-y-auto px-5 pb-4">
          {logs.map((log, i) => (
            <div
              key={i}
              className="animate-fade-in"
              style={{
                fontSize: "10px",
                lineHeight: 1.7,
                color: log.startsWith("[INSIGHT]") || log.startsWith("[EXTRACT]")
                  ? "#8baa8b"
                  : log.startsWith("[SCAN]")
                  ? "#b8b8b8"
                  : log.startsWith(">")
                  ? "#7f8a97"
                  : "#555",
                fontFamily: "var(--font-mono)",
              }}
            >
              {log || " "}
            </div>
          ))}
          {phase !== "complete" && (
            <span
              className="inline-block w-[6px] h-[12px] ml-0.5"
              style={{ background: "#7f8a97", animation: "blink-caret 0.8s step-end infinite" }}
            />
          )}
        </div>
      </div>

      <div
        className="px-5 py-2.5 flex items-center justify-between border-t"
        style={{ borderColor: "rgba(120,120,120,0.15)" }}
      >
        <span className="uppercase tracking-[0.06em]" style={{ fontFamily: "var(--font-display)", fontSize: "9px", color: "#7f8a97" }}>
          {phase === "scanning" ? "SCANNING FEED..." : phase === "extracting" ? "EXTRACTING INSIGHTS..." : "SCAN COMPLETE"}
        </span>
        <div className="flex items-center gap-1.5">
          <div
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: phase === "complete" ? "#8baa8b" : "#d0d0d0" }}
          />
          <span style={{ fontSize: "9px", color: phase === "complete" ? "#8baa8b" : "#d0d0d0" }}>
            {phase === "complete" ? "DONE" : "LIVE"}
          </span>
        </div>
      </div>
    </div>
  )
}
