"use client"

import { useState } from "react"
import NavHeader from "@/components/NavHeader"
import { KnowledgeGraph, type GraphNode } from "@/components/KnowledgeGraph"
import { LandingOverlay } from "@/components/LandingOverlay"
import { StatsPanel } from "@/components/StatsPanel"
import { Branding } from "@/components/Branding"
import { AgentViewer } from "@/components/AgentViewer"

export default function KnowledgeGraphPage() {
  const [initialized, setInitialized] = useState(false)
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)

  return (
    <div className="min-h-screen relative" style={{ background: "#0A0A0C" }}>
      {!initialized && <LandingOverlay onInitialize={() => setInitialized(true)} />}

      <KnowledgeGraph visible={initialized} onNodeClick={(n) => setSelectedNode(n)} />

      {initialized && (
        <>
          <div className="fixed inset-x-0 top-0 z-30">
            <NavHeader />
          </div>
          <StatsPanel visible={!selectedNode} />
          <Branding visible={!selectedNode} />
          <AgentViewer key={selectedNode?.id ?? "none"} node={selectedNode} onClose={() => setSelectedNode(null)} />
        </>
      )}
    </div>
  )
}
