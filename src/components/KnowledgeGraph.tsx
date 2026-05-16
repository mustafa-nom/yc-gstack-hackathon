"use client"

import { useEffect, useRef, useCallback, useState } from "react"

type ForceGraph3DInstance = {
  graphData: (data: GraphData) => ForceGraph3DInstance
  nodeThreeObject: (fn: (node: GraphNode) => unknown) => ForceGraph3DInstance
  nodeThreeObjectExtend: (val: boolean) => ForceGraph3DInstance
  nodeRelSize: (val: number) => ForceGraph3DInstance
  nodeOpacity: (val: number) => ForceGraph3DInstance
  d3VelocityDecay: (val: number) => ForceGraph3DInstance
  d3AlphaDecay: (val: number) => ForceGraph3DInstance
  d3AlphaMin: (val: number) => ForceGraph3DInstance
  d3ReheatSimulation: () => ForceGraph3DInstance
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
  // Mutated at runtime so each frame can fade/scale the node in.
  __spawnedAt?: number
  __spawnMaterials?: { material: { opacity: number; transparent: boolean }; baseOpacity: number }[]
  __threeObj?: { scale: { set: (x: number, y: number, z: number) => void } }
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

  // Stash the click handler in a ref so initGraph isn't reactive to it.
  // Without this, every parent re-render (e.g. setSelectedNode after a click)
  // would tear down and rebuild the entire 3D scene.
  const onNodeClickRef = useRef(onNodeClick)
  useEffect(() => {
    onNodeClickRef.current = onNodeClick
  }, [onNodeClick])

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
      const spawnMats: { material: { opacity: number; transparent: boolean }; baseOpacity: number }[] = []

      if (isAgent) {
        // Wireframe + translucent fill (Slipstream "domain" treatment)
        const wireGeo = new THREE.EdgesGeometry(geometry)
        const wireMat = new THREE.LineBasicMaterial({ color: 0xc1c1c1, transparent: true, opacity: 0.72 })
        group.add(new THREE.LineSegments(wireGeo, wireMat))
        spawnMats.push({ material: wireMat, baseOpacity: 0.72 })

        const fillMat = new THREE.MeshBasicMaterial({ color: 0xf0f0f0, transparent: true, opacity: 0.12 })
        group.add(new THREE.Mesh(geometry, fillMat))
        spawnMats.push({ material: fillMat, baseOpacity: 0.12 })
      } else {
        const coreOpacity = 0.78 + confidence * 0.14
        const coreMat = new THREE.MeshBasicMaterial({
          color: colorHex,
          transparent: true,
          opacity: coreOpacity,
        })
        group.add(new THREE.Mesh(geometry, coreMat))
        spawnMats.push({ material: coreMat, baseOpacity: coreOpacity })
      }

      // Inner glow
      const innerOpacity = 0.1 + confidence * 0.04
      const innerGlowMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: innerOpacity,
        side: THREE.BackSide,
      })
      group.add(new THREE.Mesh(new THREE.SphereGeometry(size * 1.16, 12, 8), innerGlowMat))
      spawnMats.push({ material: innerGlowMat, baseOpacity: innerOpacity })

      // Outer glow
      const outerOpacity = 0.045 + confidence * 0.02
      const outerGlowMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: outerOpacity,
        side: THREE.BackSide,
      })
      group.add(new THREE.Mesh(new THREE.SphereGeometry(size * 1.62, 12, 8), outerGlowMat))
      spawnMats.push({ material: outerGlowMat, baseOpacity: outerOpacity })

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
      const spriteBaseOpacity = isAgent ? 0.95 : 0.7
      const spriteMat = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        opacity: spriteBaseOpacity,
      })
      const sprite = new THREE.Sprite(spriteMat)
      sprite.scale.set(24, 6, 1)
      sprite.position.y = size + 4
      group.add(sprite)
      spawnMats.push({ material: spriteMat, baseOpacity: spriteBaseOpacity })

      // Start invisible + tiny if this node has been marked for a spawn animation.
      if (node.__spawnedAt !== undefined) {
        group.scale.set(0.001, 0.001, 0.001)
        for (const sm of spawnMats) sm.material.opacity = 0
      }
      node.__spawnMaterials = spawnMats
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
      .warmupTicks(40)
      .cooldownTicks(Infinity)
      // High damping + perpetually-warm simulation = smooth, fluid motion that
      // never freezes. New nodes can fall into place at any time.
      .d3VelocityDecay(0.72)
      .d3AlphaDecay(0.018)
      .d3AlphaMin(0)
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
        onNodeClickRef.current?.(node)
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

    // Camera intro — start way out, ease to a very wide overview
    graph.cameraPosition({ x: 0, y: 0, z: 200 }, { x: 0, y: 0, z: 0 }, 0)
    setTimeout(() => {
      graph.cameraPosition({ x: 0, y: 180, z: 1500 }, { x: 0, y: 0, z: 0 }, 4500)
    }, 200)

    graphRef.current = graph

    // Progressive growth with a bezier-eased gravity drop.
    //
    // For each new node we:
    //   1. Pick a target slot near an existing neighbor at link-distance.
    //   2. Spawn the node high above that slot, pinned with fx/fy/fz.
    //   3. Animate the pin downward over ~750ms with a cubic-bezier ease
    //      (slow in, snappy land) using requestAnimationFrame.
    //   4. Release the pin so d3-force can micro-adjust if needed.
    const agents = fullData.nodes.filter((n) => n.type === "agent")
    const trends = fullData.nodes.filter((n) => n.type === "trend")
    const insights = fullData.nodes.filter((n) => n.type === "insight")
    const nodeOrder: GraphNode[] = [...agents, ...trends, ...insights]

    const presentIds = new Set<string>()
    type PinnedNode = GraphNode & { fx?: number; fy?: number; fz?: number }
    const liveNodes: PinnedNode[] = []
    const liveLinks: GraphLink[] = []
    const liveLinkKeys = new Set<string>()
    const pinTimers: ReturnType<typeof setTimeout>[] = []
    const rafIds: number[] = []
    let cursor = 0

    const linkKey = (l: GraphLink) => {
      const s = typeof l.source === "string" ? l.source : l.source.id
      const t = typeof l.target === "string" ? l.target : l.target.id
      return `${s}->${t}`
    }

    const findNeighbor = (n: GraphNode) => {
      for (const link of fullData.links) {
        const sId = typeof link.source === "string" ? link.source : link.source.id
        const tId = typeof link.target === "string" ? link.target : link.target.id
        let neighborId: string | null = null
        if (sId === n.id && presentIds.has(tId)) neighborId = tId
        else if (tId === n.id && presentIds.has(sId)) neighborId = sId
        if (!neighborId) continue
        const found = liveNodes.find((ln) => ln.id === neighborId)
        if (found && found.x !== undefined) return found
      }
      return null
    }

    // Cubic Bezier eval — same shape as CSS cubic-bezier(p1x, p1y, p2x, p2y).
    // Returns y for a given x using Newton's method.
    const bezierEase = (p1x: number, p1y: number, p2x: number, p2y: number) => {
      const cx = 3 * p1x
      const bx = 3 * (p2x - p1x) - cx
      const ax = 1 - cx - bx
      const cy = 3 * p1y
      const by = 3 * (p2y - p1y) - cy
      const ay = 1 - cy - by
      const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t
      const sampleY = (t: number) => ((ay * t + by) * t + cy) * t
      const sampleDerivX = (t: number) => (3 * ax * t + 2 * bx) * t + cx
      return (x: number) => {
        let t = x
        for (let i = 0; i < 8; i++) {
          const xEst = sampleX(t) - x
          const d = sampleDerivX(t)
          if (Math.abs(xEst) < 1e-6 || d === 0) break
          t -= xEst / d
        }
        return sampleY(t)
      }
    }
    // Position curve — smooth ease-out, like a feather settling.
    const easeDrop = bezierEase(0.22, 0.61, 0.36, 1.0)
    // Scale/fade curve — soft start, gentle finish, slight overshoot at the end.
    const easeAppear = bezierEase(0.34, 0.0, 0.18, 1.08)

    const dropInDelay = (n: GraphNode) =>
      n.type === "agent" ? 320 : n.type === "trend" ? 240 : 180

    const dropDuration = (n: GraphNode) =>
      n.type === "agent" ? 950 : n.type === "trend" ? 800 : 650

    const animateDrop = (
      node: PinnedNode,
      from: { x: number; y: number; z: number },
      to: { x: number; y: number; z: number },
      duration: number,
    ) => {
      const start = performance.now()
      const tick = (now: number) => {
        const elapsed = now - start
        const t = Math.min(1, elapsed / duration)
        const e = easeDrop(t)
        node.fx = from.x + (to.x - from.x) * e
        node.fy = from.y + (to.y - from.y) * e
        node.fz = from.z + (to.z - from.z) * e

        // Scale + opacity fade-in driven by a separate eased curve so the body
        // of the node "blooms" in alongside the fall, with a soft settle.
        const appear = easeAppear(t)
        const s = Math.max(0.001, Math.min(1, appear))
        const obj = (node as GraphNode).__threeObj
        if (obj) obj.scale.set(s, s, s)
        const mats = (node as GraphNode).__spawnMaterials
        if (mats) {
          const fade = Math.max(0, Math.min(1, appear))
          for (const sm of mats) sm.material.opacity = sm.baseOpacity * fade
        }

        if (t < 1) {
          rafIds.push(requestAnimationFrame(tick))
        } else {
          // Snap to clean final values then release pin so d3 can micro-adjust.
          if (obj) obj.scale.set(1, 1, 1)
          if (mats) for (const sm of mats) sm.material.opacity = sm.baseOpacity
          const release = setTimeout(() => {
            node.fx = undefined
            node.fy = undefined
            node.fz = undefined
          }, 80)
          pinTimers.push(release)
        }
      }
      rafIds.push(requestAnimationFrame(tick))
    }

    const advance = () => {
      if (cursor >= nodeOrder.length) {
        growthTimerRef.current = null
        return
      }
      const node = nodeOrder[cursor++] as PinnedNode
      const neighbor = findNeighbor(node)

      const dropHeight = node.type === "agent" ? 520 : node.type === "trend" ? 360 : 240
      const linkDist = node.type === "insight" ? 95 : 130

      // Compute the landing target as neighbor + random radial offset at link
      // distance, so the node lands at roughly its layout slot.
      const target = { x: 0, y: 0, z: 0 }
      if (neighbor) {
        const angle = Math.random() * Math.PI * 2
        const phi = (Math.random() - 0.5) * Math.PI * 0.6
        target.x = (neighbor.x ?? 0) + Math.cos(angle) * Math.cos(phi) * linkDist
        target.z = (neighbor.z ?? 0) + Math.sin(angle) * Math.cos(phi) * linkDist
        target.y = (neighbor.y ?? 0) + Math.sin(phi) * linkDist
      }

      const from = { x: target.x, y: target.y + dropHeight, z: target.z }

      // Seed coords + pin at the top of the drop.
      node.x = from.x
      node.y = from.y
      node.z = from.z
      node.fx = from.x
      node.fy = from.y
      node.fz = from.z
      // Mark for spawn animation — buildNodeObject reads this flag.
      ;(node as GraphNode).__spawnedAt = performance.now()

      presentIds.add(node.id)
      liveNodes.push(node)

      for (const link of fullData.links) {
        const sId = typeof link.source === "string" ? link.source : link.source.id
        const tId = typeof link.target === "string" ? link.target : link.target.id
        if (!presentIds.has(sId) || !presentIds.has(tId)) continue
        const key = linkKey(link)
        if (liveLinkKeys.has(key)) continue
        liveLinkKeys.add(key)
        liveLinks.push(link)
      }

      graph.graphData({ nodes: [...liveNodes], links: [...liveLinks] })

      animateDrop(node, from, target, dropDuration(node))

      growthTimerRef.current = setTimeout(advance, dropInDelay(node))
    }

    const growthStart = setTimeout(advance, 1500)

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
      for (const t of pinTimers) clearTimeout(t)
      for (const id of rafIds) cancelAnimationFrame(id)
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
