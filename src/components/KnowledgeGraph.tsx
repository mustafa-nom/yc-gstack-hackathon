"use client"

import { useEffect, useRef, useCallback, useState } from "react"

type ForceGraph3DInstance = {
  graphData: (data: GraphData) => ForceGraph3DInstance
  nodeThreeObject: (fn: (node: GraphNode) => unknown) => ForceGraph3DInstance
  nodeThreeObjectExtend: (val: boolean) => ForceGraph3DInstance
  nodeRelSize: (val: number) => ForceGraph3DInstance
  nodeOpacity: (val: number) => ForceGraph3DInstance
  linkColor: (fn: (link: GraphLink) => string) => ForceGraph3DInstance
  linkOpacity: (val: number) => ForceGraph3DInstance
  linkWidth: (fn: (link: GraphLink) => number) => ForceGraph3DInstance
  linkDirectionalParticles: (fn: (link: GraphLink) => number) => ForceGraph3DInstance
  linkDirectionalParticleWidth: (val: number) => ForceGraph3DInstance
  linkDirectionalParticleSpeed: (fn: (link: GraphLink) => number) => ForceGraph3DInstance
  linkDirectionalParticleColor: (fn: () => string) => ForceGraph3DInstance
  backgroundColor: (color: string) => ForceGraph3DInstance
  onNodeClick: (fn: (node: GraphNode) => void) => ForceGraph3DInstance
  onNodeHover: (fn: (node: GraphNode | null) => void) => ForceGraph3DInstance
  d3Force: (name: string, force?: unknown) => unknown
  cameraPosition: (pos: { x: number; y: number; z: number }, lookAt?: { x: number; y: number; z: number }, ms?: number) => void
  scene: () => { add: (obj: unknown) => void }
  renderer: () => unknown
  postProcessingComposer: (composer?: unknown) => unknown
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
}

interface GraphLink {
  source: string | GraphNode
  target: string | GraphNode
  strength: number
  linkType?: "hub" | "cross"
}

interface GraphData {
  nodes: GraphNode[]
  links: GraphLink[]
}

// Visual config adapted from Slipstream (ekagra1602/Slipstream)
const VISUAL_CONFIG = {
  background: "#0A0A0C",
  bloom: { strength: 1.35, radius: 0.45, threshold: 0.28 },
  confidence: {
    low: { r: 100, g: 105, b: 115 },
    mid: { r: 140, g: 138, b: 130 },
    high: { r: 180, g: 165, b: 130 },
  },
  links: {
    hubBaseAlpha: 0.1,
    hubAlphaScale: 0.25,
    crossBaseAlpha: 0.13,
    crossAlphaScale: 0.3,
    hubBaseWidth: 0.35,
    hubWidthScale: 1.35,
    crossBaseWidth: 0.45,
    crossWidthScale: 1.55,
  },
  particles: {
    color: "#BFCBDA",
    width: 1.55,
    baseSpeed: 0.0019,
    speedScale: 0.0023,
  },
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}

function lerpRound(a: number, b: number, t: number) {
  return Math.round(a + (b - a) * t)
}

function confidenceRgb(confidence: number) {
  const conf = clamp(confidence, 0, 1)
  const { low, mid, high } = VISUAL_CONFIG.confidence
  if (conf <= 0.5) {
    const t = conf / 0.5
    return { r: lerpRound(low.r, mid.r, t), g: lerpRound(low.g, mid.g, t), b: lerpRound(low.b, mid.b, t) }
  }
  const t = (conf - 0.5) / 0.5
  return { r: lerpRound(mid.r, high.r, t), g: lerpRound(mid.g, high.g, t), b: lerpRound(mid.b, high.b, t) }
}

function confidenceHex(confidence: number) {
  const c = confidenceRgb(confidence)
  return (c.r << 16) | (c.g << 8) | c.b
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
      links.push({
        source: `agent-${agentIdx}`,
        target: `trend-${shuffled[j]}`,
        strength: 0.4 + Math.random() * 0.5,
        linkType: "hub",
      })
    }
  })

  trendNames.forEach((_, trendIdx) => {
    const numInsights = 2 + Math.floor(Math.random() * 4)
    const shuffled = [...Array(insightNames.length).keys()].sort(() => Math.random() - 0.5)
    for (let j = 0; j < numInsights; j++) {
      links.push({
        source: `trend-${trendIdx}`,
        target: `insight-${shuffled[j]}`,
        strength: 0.2 + Math.random() * 0.4,
        linkType: "hub",
      })
    }
  })

  for (let i = 0; i < 10; i++) {
    const a = Math.floor(Math.random() * trendNames.length)
    let b = Math.floor(Math.random() * trendNames.length)
    if (a === b) b = (a + 1) % trendNames.length
    links.push({
      source: `trend-${a}`,
      target: `trend-${b}`,
      strength: 0.15 + Math.random() * 0.25,
      linkType: "cross",
    })
  }

  return { nodes, links }
}

interface KnowledgeGraphProps {
  visible: boolean
  onNodeClick?: (node: GraphNode) => void
}

export type { GraphNode }

export function KnowledgeGraph({ visible, onNodeClick }: KnowledgeGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const graphRef = useRef<ForceGraph3DInstance | null>(null)
  const growthTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null)

  const initGraph = useCallback(async () => {
    if (!containerRef.current || graphRef.current) return

    const mod = await import("3d-force-graph")
    const ForceGraph3D = mod.default as unknown as (() => (el: HTMLElement) => ForceGraph3DInstance)
    const THREE = await import("three")

    const fullData = generateGraphData()
    const graph = ForceGraph3D()(containerRef.current!) as unknown as ForceGraph3DInstance

    const buildNodeObject = (node: GraphNode) => {
      const group = new THREE.Group()
      const confidence = (node.confidence ?? 50) / 100
      const colorHex = confidenceHex(confidence)
      const isAgent = node.type === "agent"
      const size = isAgent ? 7.5 : node.type === "trend" ? 3.2 : 2.2

      const geometry = new THREE.SphereGeometry(size, isAgent ? 16 : 10, isAgent ? 12 : 8)

      if (isAgent) {
        // Wireframe + translucent fill (Slipstream "domain" treatment)
        const wireGeo = new THREE.EdgesGeometry(geometry)
        const wireMat = new THREE.LineBasicMaterial({ color: 0xc1c1c1, transparent: true, opacity: 0.72 })
        group.add(new THREE.LineSegments(wireGeo, wireMat))

        const fillMat = new THREE.MeshBasicMaterial({ color: 0xf0f0f0, transparent: true, opacity: 0.12 })
        group.add(new THREE.Mesh(geometry, fillMat))
      } else {
        const coreMat = new THREE.MeshBasicMaterial({
          color: colorHex,
          transparent: true,
          opacity: 0.78 + confidence * 0.14,
        })
        group.add(new THREE.Mesh(geometry, coreMat))
      }

      // Inner glow
      const innerGlowMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.1 + confidence * 0.04,
        side: THREE.BackSide,
      })
      group.add(new THREE.Mesh(new THREE.SphereGeometry(size * 1.16, 12, 8), innerGlowMat))

      // Outer glow
      const outerGlowMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.045 + confidence * 0.02,
        side: THREE.BackSide,
      })
      group.add(new THREE.Mesh(new THREE.SphereGeometry(size * 1.62, 12, 8), outerGlowMat))

      // Label sprite
      const canvas = document.createElement("canvas")
      const ctx = canvas.getContext("2d")!
      canvas.width = 256
      canvas.height = 64
      ctx.font = `${isAgent ? "bold 14px" : "11px"} 'JetBrains Mono', monospace`
      ctx.fillStyle = isAgent ? "#d0d0d0" : node.type === "trend" ? "#a0a0a0" : "#777"
      ctx.textAlign = "center"
      ctx.fillText(node.name, 128, 36)

      const texture = new THREE.CanvasTexture(canvas)
      texture.needsUpdate = true
      const spriteMat = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        opacity: isAgent ? 0.95 : 0.7,
      })
      const sprite = new THREE.Sprite(spriteMat)
      sprite.scale.set(24, 6, 1)
      sprite.position.y = size + 4
      group.add(sprite)

      return group
    }

    const linkColorFn = (link: GraphLink) => {
      const strength = clamp(link.strength ?? 0.45, 0, 1)
      if (link.linkType === "cross") {
        const alpha = VISUAL_CONFIG.links.crossBaseAlpha + strength * VISUAL_CONFIG.links.crossAlphaScale
        return `rgba(176, 184, 194, ${alpha.toFixed(2)})`
      }
      const alpha = VISUAL_CONFIG.links.hubBaseAlpha + strength * VISUAL_CONFIG.links.hubAlphaScale
      return `rgba(140, 145, 152, ${alpha.toFixed(2)})`
    }

    const linkWidthFn = (link: GraphLink) => {
      const strength = clamp(link.strength ?? 0.45, 0, 1)
      if (link.linkType === "cross") {
        return VISUAL_CONFIG.links.crossBaseWidth + strength * VISUAL_CONFIG.links.crossWidthScale
      }
      return VISUAL_CONFIG.links.hubBaseWidth + strength * VISUAL_CONFIG.links.hubWidthScale
    }

    const linkParticleSpeedFn = (link: GraphLink) => {
      const strength = clamp(link.strength ?? 0.45, 0, 1)
      return VISUAL_CONFIG.particles.baseSpeed + strength * VISUAL_CONFIG.particles.speedScale
    }

    graph
      .backgroundColor(VISUAL_CONFIG.background)
      .showNavInfo(false)
      .enableNodeDrag(false)
      .warmupTicks(160)
      .cooldownTicks(120)
      .graphData({ nodes: [], links: [] })
      .nodeRelSize(1)
      .nodeOpacity(0.92)
      .nodeThreeObject(buildNodeObject)
      .nodeThreeObjectExtend(false)
      .linkColor(linkColorFn)
      .linkOpacity(0.6)
      .linkWidth(linkWidthFn)
      .linkDirectionalParticles((link: GraphLink) => {
        const src = typeof link.source === "object" ? link.source : null
        return src && (src as GraphNode).type === "agent" ? 3 : 1
      })
      .linkDirectionalParticleWidth(VISUAL_CONFIG.particles.width)
      .linkDirectionalParticleSpeed(linkParticleSpeedFn)
      .linkDirectionalParticleColor(() => VISUAL_CONFIG.particles.color)
      .onNodeClick((node: GraphNode) => {
        onNodeClick?.(node)
        const dist = node.type === "agent" ? 160 : 100
        graph.cameraPosition(
          {
            x: (node.x ?? 0) + dist * 0.5,
            y: (node.y ?? 0) + dist * 0.3,
            z: (node.z ?? 0) + dist,
          },
          { x: node.x ?? 0, y: node.y ?? 0, z: node.z ?? 0 },
          1200
        )
      })
      .onNodeHover((node: GraphNode | null) => {
        setHoveredNode(node)
        if (containerRef.current) {
          containerRef.current.style.cursor = node ? "pointer" : "default"
        }
      })

    // Forces (Slipstream)
    const chargeForce = graph.d3Force("charge") as { strength?: (fn: (n: GraphNode) => number) => void } | null
    if (chargeForce?.strength) {
      chargeForce.strength((n: GraphNode) => (n.type === "agent" ? -480 : -160))
    }
    const linkForce = graph.d3Force("link") as { distance?: (fn: (l: GraphLink) => number) => void } | null
    if (linkForce?.distance) {
      linkForce.distance((l: GraphLink) => (l.linkType === "cross" ? 160 : 95))
    }

    // Bloom post-processing
    try {
      const { EffectComposer } = await import("three/examples/jsm/postprocessing/EffectComposer.js")
      const { RenderPass } = await import("three/examples/jsm/postprocessing/RenderPass.js")
      const { UnrealBloomPass } = await import("three/examples/jsm/postprocessing/UnrealBloomPass.js")

      const renderer = graph.renderer()
      const scene = graph.scene()
      const camera = (graph as unknown as { camera: () => unknown }).camera()

      if (renderer && scene && camera) {
        const composer = new EffectComposer(renderer as unknown as InstanceType<typeof import("three").WebGLRenderer>)
        const renderPass = new RenderPass(
          scene as unknown as InstanceType<typeof import("three").Scene>,
          camera as InstanceType<typeof import("three").Camera>
        )
        composer.addPass(renderPass)
        const bloomPass = new UnrealBloomPass(
          new THREE.Vector2(window.innerWidth, window.innerHeight),
          VISUAL_CONFIG.bloom.strength,
          VISUAL_CONFIG.bloom.radius,
          VISUAL_CONFIG.bloom.threshold
        )
        composer.addPass(bloomPass)
        graph.postProcessingComposer(composer)
      }
    } catch {
      // bloom optional
    }

    // Camera intro — start far, ease to a wide overview
    graph.cameraPosition({ x: 0, y: 0, z: 60 }, { x: 0, y: 0, z: 0 }, 0)
    setTimeout(() => {
      graph.cameraPosition({ x: 0, y: 120, z: 950 }, { x: 0, y: 0, z: 0 }, 4200)
    }, 200)

    graphRef.current = graph

    // Progressive growth: add nodes in waves (agents one-by-one, trends paired, insights in small batches)
    // to keep the d3 force simulation from reheating too aggressively.
    const agents = fullData.nodes.filter((n) => n.type === "agent")
    const trends = fullData.nodes.filter((n) => n.type === "trend")
    const insights = fullData.nodes.filter((n) => n.type === "insight")

    type GrowthStep = { nodes: GraphNode[]; delay: number }
    const steps: GrowthStep[] = []
    for (const a of agents) steps.push({ nodes: [a], delay: 220 })
    for (let i = 0; i < trends.length; i += 2) {
      steps.push({ nodes: trends.slice(i, i + 2), delay: 180 })
    }
    for (let i = 0; i < insights.length; i += 4) {
      steps.push({ nodes: insights.slice(i, i + 4), delay: 140 })
    }

    const presentIds = new Set<string>()
    const liveNodes: GraphNode[] = []
    const liveLinks: GraphLink[] = []
    let cursor = 0

    const seedPositionNearNeighbor = (n: GraphNode) => {
      // Find an already-placed neighbor and seed the new node's coords near it
      // so d3-force only has to nudge it slightly instead of teleport it.
      for (const link of fullData.links) {
        const sId = typeof link.source === "string" ? link.source : link.source.id
        const tId = typeof link.target === "string" ? link.target : link.target.id
        let neighborId: string | null = null
        if (sId === n.id && presentIds.has(tId)) neighborId = tId
        else if (tId === n.id && presentIds.has(sId)) neighborId = sId
        if (!neighborId) continue
        const neighbor = liveNodes.find((ln) => ln.id === neighborId)
        if (neighbor && neighbor.x !== undefined) {
          const jitter = 40
          n.x = (neighbor.x ?? 0) + (Math.random() - 0.5) * jitter
          n.y = (neighbor.y ?? 0) + (Math.random() - 0.5) * jitter
          n.z = (neighbor.z ?? 0) + (Math.random() - 0.5) * jitter
          return
        }
      }
    }

    const advance = () => {
      if (cursor >= steps.length) {
        growthTimerRef.current = null
        return
      }
      const step = steps[cursor++]
      for (const n of step.nodes) {
        seedPositionNearNeighbor(n)
        presentIds.add(n.id)
        liveNodes.push(n)
      }
      for (const link of fullData.links) {
        const sId = typeof link.source === "string" ? link.source : link.source.id
        const tId = typeof link.target === "string" ? link.target : link.target.id
        if (presentIds.has(sId) && presentIds.has(tId) && !liveLinks.includes(link)) {
          liveLinks.push(link)
        }
      }
      graph.graphData({ nodes: [...liveNodes], links: [...liveLinks] })
      growthTimerRef.current = setTimeout(advance, step.delay)
    }

    const growthStart = setTimeout(advance, 1400)

    const handleResize = () => {
      if (graphRef.current) {
        graphRef.current.width(window.innerWidth)
        graphRef.current.height(window.innerHeight)
      }
    }
    window.addEventListener("resize", handleResize)
    return () => {
      window.removeEventListener("resize", handleResize)
      clearTimeout(growthStart)
      if (growthTimerRef.current) {
        clearTimeout(growthTimerRef.current)
        growthTimerRef.current = null
      }
    }
  }, [onNodeClick])

  useEffect(() => {
    if (visible) {
      const cleanup = initGraph()
      return () => {
        cleanup?.then?.((fn) => fn?.())
        if (graphRef.current) {
          try { graphRef.current._destructor() } catch { /* noop */ }
          graphRef.current = null
        }
      }
    }
  }, [visible, initGraph])

  if (!visible) return null

  return (
    <>
      <div ref={containerRef} className="fixed inset-0 z-0" />
      {hoveredNode && (
        <div
          className="fixed z-30 glass-panel rounded-sm px-3 py-2 pointer-events-none"
          style={{ top: "50%", left: "50%", transform: "translate(-50%, -120%)" }}
        >
          <div className="flex items-center gap-2">
            <div
              className="w-1.5 h-1.5 rounded-full"
              style={{
                background:
                  hoveredNode.type === "agent"
                    ? "#d0d0d0"
                    : hoveredNode.type === "trend"
                    ? "#a0a0a0"
                    : "#777",
              }}
            />
            <span
              className="uppercase tracking-[0.06em]"
              style={{ fontFamily: "var(--font-display)", fontSize: "10px", color: "#d0d0d0" }}
            >
              {hoveredNode.name}
            </span>
          </div>
          <p style={{ fontSize: "9px", color: "#7f8a97", marginTop: 2 }}>
            {hoveredNode.type.toUpperCase()} / {hoveredNode.domain.toUpperCase()} / {hoveredNode.confidence}% CONF
          </p>
        </div>
      )}
    </>
  )
}
