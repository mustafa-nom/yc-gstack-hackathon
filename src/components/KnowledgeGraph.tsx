"use client"

import { useEffect, useRef, useCallback, useState } from "react"

type ForceGraph3DInstance = {
  graphData: (data: GraphData) => ForceGraph3DInstance
  nodeThreeObject: (fn: (node: GraphNode) => unknown) => ForceGraph3DInstance
  nodeThreeObjectExtend: (val: boolean) => ForceGraph3DInstance
  linkColor: (fn: (link: GraphLink) => string) => ForceGraph3DInstance
  linkOpacity: (val: number) => ForceGraph3DInstance
  linkWidth: (fn: (link: GraphLink) => number) => ForceGraph3DInstance
  linkDirectionalParticles: (fn: (link: GraphLink) => number) => ForceGraph3DInstance
  linkDirectionalParticleWidth: (val: number) => ForceGraph3DInstance
  linkDirectionalParticleSpeed: (val: number) => ForceGraph3DInstance
  linkDirectionalParticleColor: (fn: () => string) => ForceGraph3DInstance
  backgroundColor: (color: string) => ForceGraph3DInstance
  onNodeClick: (fn: (node: GraphNode) => void) => ForceGraph3DInstance
  onNodeHover: (fn: (node: GraphNode | null) => void) => ForceGraph3DInstance
  d3Force: (name: string, force?: unknown) => unknown
  cameraPosition: (pos: { x: number; y: number; z: number }, lookAt?: { x: number; y: number; z: number }, ms?: number) => void
  scene: () => { add: (obj: unknown) => void }
  renderer: () => { toneMapping?: number; toneMappingExposure?: number }
  postProcessingComposer: () => unknown
  width: (val: number) => ForceGraph3DInstance
  height: (val: number) => ForceGraph3DInstance
  showNavInfo: (val: boolean) => ForceGraph3DInstance
  enableNodeDrag: (val: boolean) => ForceGraph3DInstance
  warmupTicks: (val: number) => ForceGraph3DInstance
  cooldownTicks: (val: number) => ForceGraph3DInstance
  _destructor: () => void
}

interface GraphNode {
  id: string
  name: string
  type: "agent" | "insight" | "trend"
  confidence: number
  domain: string
  group: number
  val: number
  x?: number
  y?: number
  z?: number
  fx?: number
  fy?: number
  fz?: number
  __threeObj?: { scale: { set: (x: number, y: number, z: number) => void } }
}

interface GraphLink {
  source: string | GraphNode
  target: string | GraphNode
  strength: number
}

interface GraphData {
  nodes: GraphNode[]
  links: GraphLink[]
}

const DOMAINS = [
  "fashion", "fitness", "cooking", "tech", "finance",
  "beauty", "travel", "gaming", "music", "education",
  "comedy", "pets", "diy", "health", "sustainability",
]

const AGENT_NAMES = [
  "SCOUT-01", "SCOUT-02", "SCOUT-03", "SCOUT-04",
  "MINER-01", "MINER-02", "MINER-03",
  "SYNTH-01",
]

function generateGraphData(): GraphData {
  const nodes: GraphNode[] = []
  const links: GraphLink[] = []

  AGENT_NAMES.forEach((name, i) => {
    nodes.push({
      id: `agent-${i}`,
      name,
      type: "agent",
      confidence: 70 + Math.floor(Math.random() * 25),
      domain: DOMAINS[i % DOMAINS.length],
      group: 0,
      val: 18,
    })
  })

  const trendNames = [
    "Hook Patterns", "Sound Trends", "Algorithm Shift", "Niche Signal",
    "Engagement Spike", "Format Evolution", "Audience Drift", "Viral Cascade",
    "Content Velocity", "Cross-Platform Leak", "Creator Economy", "AI Content Wave",
    "Micro-Community", "Deinfluencing", "Long-Form Pivot", "Duet Chains",
    "Story Arc Format", "Educational Shift", "B2B TikTok", "Shoppable Content",
    "UGC Explosion", "Nostalgia Trend", "Behind-the-Scenes", "Data Storytelling",
  ]

  trendNames.forEach((name, i) => {
    nodes.push({
      id: `trend-${i}`,
      name,
      type: "trend",
      confidence: 40 + Math.floor(Math.random() * 50),
      domain: DOMAINS[i % DOMAINS.length],
      group: 1,
      val: 8 + Math.floor(Math.random() * 6),
    })
  })

  const insightNames = [
    "Question hooks +34%", "6-8PM EST window", "Split-screen up 89%",
    "Watch time > likes", "Ambient beats retain", "15s sweet spot",
    "CTA in first 3s", "Reply bait works", "Stitch momentum",
    "Green screen revival", "Text overlay meta", "Native voice > TTS",
    "Loop structure viral", "Comment-driven reach", "Save rate signal",
    "Profile visit funnel", "Hashtag clustering", "Series content boost",
    "Collab multiplier", "Trend jacking timing", "Audio-first strategy",
    "Emotional arc peaks", "Controversial hooks", "Value stacking",
    "Pattern interrupt", "Social proof overlay", "Scarcity in bio",
    "Carousel format test", "Repost algorithm", "Batch posting effect",
    "Morning scroll spike", "Weekend engagement dip", "Monday motivation peak",
    "Thumbnail A/B shift", "Caption length sweet", "Emoji density curve",
    "Follower quality score", "Shadow ban signals", "Reach vs impression ratio",
    "Avg watch % benchmark",
  ]

  insightNames.forEach((name, i) => {
    nodes.push({
      id: `insight-${i}`,
      name,
      type: "insight",
      confidence: 30 + Math.floor(Math.random() * 60),
      domain: DOMAINS[i % DOMAINS.length],
      group: 2,
      val: 4 + Math.floor(Math.random() * 4),
    })
  })

  AGENT_NAMES.forEach((_, agentIdx) => {
    const numTrends = 3 + Math.floor(Math.random() * 4)
    const shuffled = [...Array(trendNames.length).keys()].sort(() => Math.random() - 0.5)
    for (let j = 0; j < numTrends; j++) {
      links.push({ source: `agent-${agentIdx}`, target: `trend-${shuffled[j]}`, strength: 0.4 + Math.random() * 0.5 })
    }
  })

  trendNames.forEach((_, trendIdx) => {
    const numInsights = 2 + Math.floor(Math.random() * 4)
    const shuffled = [...Array(insightNames.length).keys()].sort(() => Math.random() - 0.5)
    for (let j = 0; j < numInsights; j++) {
      links.push({ source: `trend-${trendIdx}`, target: `insight-${shuffled[j]}`, strength: 0.2 + Math.random() * 0.4 })
    }
  })

  for (let i = 0; i < 10; i++) {
    const a = Math.floor(Math.random() * trendNames.length)
    let b = Math.floor(Math.random() * trendNames.length)
    if (a === b) b = (a + 1) % trendNames.length
    links.push({ source: `trend-${a}`, target: `trend-${b}`, strength: 0.15 + Math.random() * 0.25 })
  }

  return { nodes, links }
}

export type { GraphNode }

export function KnowledgeGraph({ visible }: { visible: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const graphRef = useRef<ForceGraph3DInstance | null>(null)
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null)

  const initGraph = useCallback(async () => {
    if (!containerRef.current || graphRef.current) return

    const ForceGraph3D = (await import("3d-force-graph")).default as unknown as (el: HTMLElement) => ForceGraph3DInstance
    const THREE = await import("three")

    const graphData = generateGraphData()
    const graph = ForceGraph3D(containerRef.current!)

    graph
      .backgroundColor("#09090b")
      .showNavInfo(false)
      .enableNodeDrag(false)
      .warmupTicks(80)
      .cooldownTicks(40)
      .graphData(graphData)
      .nodeThreeObject((node: GraphNode) => {
        const group = new THREE.Group()

        const size = node.type === "agent" ? 4 : node.type === "trend" ? 2.5 : 1.5
        const conf = (node.confidence ?? 50) / 100
        const r = Math.round(100 + conf * 80)
        const g = Math.round(105 + conf * 60)
        const b = Math.round(115 + conf * 15)
        const color = new THREE.Color(`rgb(${r},${g},${b})`)

        const sphere = new THREE.Mesh(
          new THREE.SphereGeometry(size, 16, 12),
          new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 })
        )
        group.add(sphere)

        const glow = new THREE.Mesh(
          new THREE.SphereGeometry(size * 1.8, 16, 12),
          new THREE.MeshBasicMaterial({ color, transparent: true, opacity: node.type === "agent" ? 0.15 : 0.08 })
        )
        group.add(glow)

        if (node.type === "agent") {
          const ring = new THREE.Mesh(
            new THREE.RingGeometry(size * 1.5, size * 1.7, 32),
            new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3, side: THREE.DoubleSide })
          )
          group.add(ring)
        }

        const canvas = document.createElement("canvas")
        const ctx = canvas.getContext("2d")!
        canvas.width = 256
        canvas.height = 64
        ctx.font = `${node.type === "agent" ? "bold 14px" : "11px"} monospace`
        ctx.fillStyle = node.type === "agent" ? "#d0d0d0" : node.type === "trend" ? "#a0a0a0" : "#777"
        ctx.textAlign = "center"
        ctx.fillText(node.name, 128, 36)

        const texture = new THREE.CanvasTexture(canvas)
        texture.needsUpdate = true
        const sprite = new THREE.Sprite(
          new THREE.SpriteMaterial({ map: texture, transparent: true, opacity: node.type === "agent" ? 0.95 : 0.7 })
        )
        sprite.scale.set(24, 6, 1)
        sprite.position.y = size + 4
        group.add(sprite)

        return group
      })
      .nodeThreeObjectExtend(false)
      .linkColor((link: GraphLink) => {
        const alpha = Math.round(25 + (link.strength ?? 0.3) * 50)
        return `rgba(160,160,160,${alpha / 255})`
      })
      .linkOpacity(0.3)
      .linkWidth((link: GraphLink) => 0.3 + (link.strength ?? 0.3) * 1.2)
      .linkDirectionalParticles((link: GraphLink) => {
        const src = typeof link.source === "object" ? link.source : null
        return src && (src as GraphNode).type === "agent" ? 3 : 1
      })
      .linkDirectionalParticleWidth(1.2)
      .linkDirectionalParticleSpeed(0.003)
      .linkDirectionalParticleColor(() => "#BFCBDA")
      .onNodeHover((node: GraphNode | null) => {
        setHoveredNode(node)
        if (containerRef.current) containerRef.current.style.cursor = node ? "pointer" : "default"
      })
      .onNodeClick(() => {})

    try {
      const { EffectComposer } = await import("three/examples/jsm/postprocessing/EffectComposer.js")
      const { RenderPass } = await import("three/examples/jsm/postprocessing/RenderPass.js")
      const { UnrealBloomPass } = await import("three/examples/jsm/postprocessing/UnrealBloomPass.js")
      const renderer = graph.renderer()
      const scene = graph.scene()
      const camera = (graph as unknown as { camera: () => unknown }).camera()
      if (renderer && scene && camera) {
        const composer = new EffectComposer(renderer as unknown as import("three").WebGLRenderer)
        composer.addPass(new RenderPass(scene as unknown as import("three").Scene, camera as import("three").Camera))
        composer.addPass(new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.2, 0.4, 0.3))
      }
    } catch { /* bloom unavailable */ }

    graph.cameraPosition({ x: 0, y: 0, z: 4 }, { x: 0, y: 0, z: 0 }, 0)
    setTimeout(() => graph.cameraPosition({ x: 100, y: 80, z: 420 }, { x: 0, y: 0, z: 0 }, 3500), 100)

    const forceLink = graph.d3Force("link") as { distance?: (fn: () => number) => void } | null
    forceLink?.distance?.(() => 60 + Math.random() * 40)
    const forceCharge = graph.d3Force("charge") as { strength?: (fn: () => number) => void } | null
    forceCharge?.strength?.(() => -120)

    graphRef.current = graph

    const handleResize = () => {
      graphRef.current?.width(window.innerWidth)
      graphRef.current?.height(window.innerHeight)
    }
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  useEffect(() => {
    if (!visible) return
    const cleanup = initGraph()
    return () => {
      cleanup?.then?.((fn) => fn?.())
      if (graphRef.current) {
        try { graphRef.current._destructor() } catch { /* noop */ }
        graphRef.current = null
      }
    }
  }, [visible, initGraph])

  if (!visible) return null

  return (
    <>
      <div ref={containerRef} className="fixed inset-0 z-0" />
      {hoveredNode && (
        <div
          className="fixed z-30 pointer-events-none bg-black/60 border border-white/10 rounded px-3 py-2 backdrop-blur-sm"
          style={{ top: "50%", left: "50%", transform: "translate(-50%, -120%)" }}
        >
          <div className="flex items-center gap-2">
            <div
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: hoveredNode.type === "agent" ? "#d0d0d0" : hoveredNode.type === "trend" ? "#a0a0a0" : "#777" }}
            />
            <span className="uppercase tracking-widest text-[10px] text-white/80 font-mono">
              {hoveredNode.name}
            </span>
          </div>
          <p className="text-[9px] text-white/40 mt-1 font-mono">
            {hoveredNode.type.toUpperCase()} / {hoveredNode.domain.toUpperCase()} / {hoveredNode.confidence}% CONF
          </p>
        </div>
      )}
    </>
  )
}
