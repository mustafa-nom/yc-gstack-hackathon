# Architecture

End-to-end view of how the app fits together. Diagrams render natively on GitHub.

## 1. System overview

```mermaid
graph TB
  subgraph Browser["Browser (Next.js 16 App Router)"]
    OB["/ — OnboardingFlow.tsx<br/>multi-step wizard"]
    GR["/graph — LiveGraph.tsx<br/>3d-force-graph + SSE"]
    CT["/content — ContentStudio.tsx<br/>carousel preview"]
    PF["/performance — ContentCalendar +<br/>PerformanceLoop"]
    AL["AgentLogPanel<br/>(graph-page overlay)"]
    RC["run-context.ts<br/>localStorage runId"]
    OB & GR & CT & PF -.uses.-> RC
    GR --> AL
  end

  subgraph NextServer["Next.js server (Node runtime)"]
    SA_ONB["actions/onboard.ts<br/>startOnboarding()"]
    SA_GEN["actions/generate-designs.ts<br/>spawns Python carousel"]
    SA_PSH["actions/push-to-tiktok.ts"]
    SA_REG["actions/regenerate.ts"]
    SA_PRF["actions/performance.ts"]
    SSE["api/graph/stream/route.ts<br/>SSE endpoint"]

    ORCH["lib/orchestrator.ts<br/>kickoffOrchestrator()"]
    WORK["lib/hog/worker.ts<br/>runNicheIngestion()"]
    BUS["lib/graph-bus.ts<br/>in-memory pub/sub + replay"]
    STATE["lib/state.ts<br/>.brainpost/ JSON I/O<br/>(resolveSafe guard)"]

    ICP["lib/agents/icp.ts<br/>inferIcp + scrapeSite"]
    SYN["lib/agents/synthesize.ts"]
    MOD["lib/agents/model.ts<br/>provider auto-select"]

    HOG["lib/hog/client.ts<br/>searchHog()"]
    XFM["lib/hog/transformer.ts<br/>transformAndWrite()"]
    GB["lib/gbrain.ts<br/>execFile subprocess"]
    CPF["lib/carousel-prefetch.ts<br/>sessionStorage cache"]
  end

  subgraph PyBackend["Python backend (FastAPI :8000)"]
    PY_GEN["/generate (SSE)<br/>spawns generate_carousel.py"]
    PY_ANL["/analyze (SSE, legacy)"]
    CAROUSEL["backend/carousel/<br/>generate_content → generate_images → composite"]
    PY_GEN --> CAROUSEL
  end

  subgraph External["External services"]
    ANT[("Anthropic API<br/>Claude")]
    OAI[("OpenAI API<br/>GPT-4o")]
    HOGAPI[("Hog AI API<br/>TikTok search")]
    GEMINI[("Google Gemini<br/>image generation")]
    GBSUB[("gbrain CLI subprocess<br/>PGLite-backed store")]
    BPOST[("./.brainpost/<br/>user.json, personal.md")]
  end

  OB -- "1. startOnboarding(input)" --> SA_ONB
  OB -- "2. EventSource(/api/graph/stream?runId=...)" --> SSE
  CT -- "fetch /generate (SSE)" --> PY_GEN
  CT -- "generateDesigns()" --> SA_GEN
  CT -.cache.-> CPF
  AL -- "generateDesigns()" --> SA_GEN
  AL -- "pushToTiktok()" --> SA_PSH

  SA_ONB --> ICP
  SA_ONB --> STATE
  SA_ONB --> BUS
  SA_ONB -- "kickoff (fire-and-forget)" --> ORCH
  ORCH --> WORK
  WORK --> HOG
  WORK --> SYN
  WORK --> XFM
  WORK --> BUS
  XFM --> GB

  SSE -- "replay + subscribe" --> BUS

  ICP --> MOD
  SYN --> MOD
  MOD --> ANT
  MOD --> OAI
  HOG --> HOGAPI
  GB --> GBSUB
  STATE --> BPOST

  SA_GEN -- "spawn (child_process)" --> CAROUSEL
  CAROUSEL --> ANT
  CAROUSEL --> GEMINI
```

## 2. Onboarding flow (the hot path)

```mermaid
sequenceDiagram
  participant U as User
  participant OB as OnboardingFlow (browser)
  participant SA as startOnboarding (server action)
  participant ICP as inferIcp / scrapeSite
  participant ORCH as orchestrator
  participant W as runNicheIngestion (×N)
  participant BUS as graphBus
  participant SSE as /api/graph/stream
  participant GB as gbrain CLI

  U->>OB: Fill website / description / tiktok
  U->>OB: Click "Analyze"
  OB->>SA: startOnboarding({website, description, tiktok})
  activate SA
  SA->>BUS: publish "Initializing", "Target: ..."
  SA-->>OB: { runId }   (returns immediately)
  deactivate SA

  par client subscribes
    OB->>SSE: open EventSource(?runId=...)
    SSE->>BUS: replay(runId)
    SSE-->>OB: stream backlog
    SSE->>BUS: subscribe(runId)
  and server pipeline (fire-and-forget)
    SA->>ICP: scrapeSite(url) — SSRF-guarded
    SA->>ICP: inferIcp(...)  — Claude OR OpenAI via model.ts
    SA->>BUS: publish ICP + niches log lines
    SA->>ORCH: kickoffOrchestrator({runId, niches})
    loop for each niche (parallel)
      ORCH->>W: runNicheIngestion(niche)
      W->>BUS: publish "Searching Hog..."
      W->>W: searchHog(query)
      W->>W: synthesizeStrategyFromCaptions(...)
      W->>BUS: publish nodes/edges + nicheReady
      W->>GB: transformAndWrite (awaited; data-loss bug fixed)
      W->>BUS: publish "GBrain pages written"
    end
    ORCH->>BUS: publish allReady
  end

  loop SSE -> client
    BUS-->>SSE: forward each event
    SSE-->>OB: data: {kind, ...}\n\n
    OB->>OB: drainTypeQueue + setLogLines / setLiveGraph
  end

  Note over BUS: 60s after allReady,<br/>orchestrator cleanup<br/>drops inflight + buffer<br/>+ writtenSlugs (B1/B2/F1)

  U->>OB: Click "View live graph"
  OB->>OB: router.push(/graph?runId=...)
```

## 3. Carousel generation flow

```mermaid
sequenceDiagram
  participant U as User
  participant CS as ContentStudio (browser)
  participant CPF as carousel-prefetch.ts
  participant PY as FastAPI /generate
  participant CAR as backend/carousel/*
  participant ANT as Anthropic
  participant GEM as Gemini

  U->>CS: Click "Generate"
  CS->>CPF: ensureCarousel(count, persona)
  CPF->>CPF: check sessionStorage cache
  alt cache hit
    CPF-->>CS: cached imageUrls
  else cache miss
    CPF->>PY: POST /generate (SSE)
    PY->>CAR: spawn generate_carousel.py<br/>(N1: data.topics injected as argv — blocker)
    CAR->>ANT: generate_content.py — slide copy via Claude
    CAR->>GEM: generate_images.py — image per slide
    CAR->>CAR: composite.py — overlay text via PIL
    PY-->>CPF: SSE log lines + final {imageUrls}
    CPF->>CPF: cache to sessionStorage
    CPF-->>CS: imageUrls
  end
  CS->>CS: render carousel ←<br/>(N2: PY hangs whole event loop<br/>while subprocess runs — blocker)
  CS-->>U: slides 1..N
```

## 4. Data stores & lifetimes

| Store | Location | Lifetime | Notes |
|---|---|---|---|
| **graphBus.buffers** | Node process memory | 60s after allReady | per-runId event log for SSE replay |
| **inflight orchestrator** | Node process memory | 60s after settle | dedup against double-kicks |
| **writtenSlugsByRun** | Node process memory | 60s after settle | first-write-wins dedup for GBrain pages across a run |
| **runId** | `window.localStorage` | indefinite | ⚠ E1: leaks across tabs/users on shared browsers |
| **user.json + personal.md** | `./.brainpost/` (disk) | indefinite | onboarding result snapshot |
| **GBrain pages** | gbrain PGLite (subprocess-owned) | indefinite | niches/, creators/, hooks/, patterns/ |
| **carousel cache** | `window.sessionStorage` | tab lifetime | keyed by slide count |
| **carousel images** | `backend/carousel/output/` → mounted at `/slides/*` | until next `/generate` (rmtree) | |

## 5. Provider selection (model.ts)

```mermaid
graph LR
  CALL["inferIcp / synthesize<br/>callsite"] --> M["getAgentModel(task)"]
  M -->|ANTHROPIC_API_KEY set| ANT["anthropic('claude-opus-4-7')"]
  M -->|else OPENAI_API_KEY set| OAI["openai('gpt-4o')"]
  M -->|neither| ERR["throw — clear error"]
  M -.optional override.- ENV["ICP_MODEL / SYNTH_MODEL env<br/>(must match selected provider)"]
```

## 6. Key cross-cutting concerns

- **Auth**: none. Every server action and the SSE route are public POST/GET. Single-tenant by convention.
- **SSRF**: `scrapeSite` validates scheme + denies loopback / RFC1918 / link-local / CGNAT + re-validates on every redirect hop (manual redirect mode).
- **Path traversal**: `state.ts` writes/reads only via `resolveSafe(rel)` which fails on any path that escapes `BASE`.
- **Provider neutrality**: agents go through `getAgentModel`; the same code runs against Claude or OpenAI depending on `.env`.
- **In-flight cancellation**: not implemented. Closing the browser tab does not abort the Claude/Hog calls already running on the server (deferred: J1).

See [CHANGELOG.md](CHANGELOG.md) for the running engineering log and outstanding deferred items.
