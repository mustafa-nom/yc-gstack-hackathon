# Changelog

Engineering log of significant changes, reviews, and decisions on `main`.
Most recent at the top.

---

## 2026-05-16 — End-to-end codebase scan

Full sweep of main (HEAD `a2c6e4c`). Build + lint + tsc all clean — 0 errors, 6 minor warnings. Dispatched four parallel scans (frontend components, server libs, server actions / API routes, backend Python) and triaged claims against the actual source. Findings below exclude items already tracked in the [deferred table](#known-deferred-items) of the previous section.

### Build state
- `npx tsc --noEmit`: clean
- `npm run lint`: 0 errors, 6 warnings (unused imports + 1 `<img>` LCP hint)
- `npm run build`: success, 6 routes (`/`, `/api/graph/stream`, `/content`, `/graph`, `/performance`, `/_not-found`)

### NEW findings (not in prior deferred table)

| ID | Severity | Where | Issue | Fix sketch |
|---|---|---|---|---|
| **N1** | Blocker | [`backend/main.py:90`](backend/main.py#L90) | `cmd += data.topics` appends raw user-supplied strings as argv. A topic starting with `--` (e.g. `--output-dir`) is interpreted by argparse as a flag, letting a client redirect output paths or toggle `--skip-images`. Frontend currently controls topics, but cross-origin is only blocked by CORS to `localhost:3000`. | Insert `"--"` before `cmd += data.topics` so argparse treats them positionally; or whitelist `[a-zA-Z0-9 _-]` per topic. |
| **N2** | Blocker | [`backend/main.py:96-98`](backend/main.py#L96-L98) | `subprocess.Popen` + sync `for line in proc.stdout:` + `proc.wait()` block the asyncio event loop inside an `async def`. Every concurrent `/generate` call serializes; a hung subprocess freezes all other requests on the worker. | Use `asyncio.create_subprocess_exec` + `async for line in proc.stdout:` and `await proc.wait()`. |
| **N3** | Major | [`backend/main.py:92`](backend/main.py#L92) | `subprocess.Popen` has no timeout. If `generate_carousel.py` hangs (yt-dlp stall, hung Gemini call), the SSE stream wedges forever. | Wrap `proc.wait()` in `asyncio.wait_for(..., timeout=300)`; kill on expiry. |
| **N4** | Major | [`src/app/actions/regenerate.ts:8`](src/app/actions/regenerate.ts#L8) | `learningId` is interpolated into `readJson(\`learnings/${learningId}.json\`)`. `resolveSafe` blocks `../` traversal, but the field accepts any string — whitespace, null bytes, glob chars. Subsequent `gbrain` arg use of the resolved file's content could break or surprise. | `z.string().regex(/^[A-Za-z0-9_-]{6,64}$/)` validation at the top of the action. |
| **N5** | Major | [`src/app/actions/onboard.ts:9-13`](src/app/actions/onboard.ts#L9-L13) | `OnboardInput` is `{ website, description?, referenceTiktok? }` with no schema. `scrapeSite` validates URLs downstream, but `description` is unbounded — a megabyte-long string flows into the Claude ICP prompt and runs up cost. | Zod schema: `website: z.string().url().max(2048)`, `description: z.string().max(4000).optional()`, `referenceTiktok: z.string().url().max(2048).optional()`. |
| **N6** | Major | [`src/components/Dashboard.tsx:7,18`](src/components/Dashboard.tsx#L7) | `Dashboard` is dead code — no route renders it — but its import of `KnowledgeGraph` keeps a ~700-line file alive in the bundle. KnowledgeGraph itself has Three.js disposal gaps that don't matter while it's unmounted, but will if Dashboard is ever re-mounted. | Either delete `Dashboard.tsx` + `KnowledgeGraph.tsx`, or actually route Dashboard. |
| **N7** | Minor | [`backend/main.py:26`](backend/main.py#L26) | `allow_headers=["*"]` is broad given the origin lock is just `localhost:3000`. Cookie/Authorization leakage isn't currently an issue (no auth), but the wildcard becomes risky the moment auth lands. | `allow_headers=["Content-Type", "Accept"]`. |
| **N8** | Minor | [`backend/claude_client.py`](backend/claude_client.py), [`backend/scraper.py:71,85`](backend/scraper.py#L71) | Multiple bare `except Exception:` blocks with silent returns. Production failures will have no breadcrumbs. | At minimum `logging.warning` the exception before the fallback return. |
| **N9** | Minor | [`backend/main.py:106`](backend/main.py#L106) | Generic `'Generation failed.'` error to client — no `returncode`, no stderr capture (stderr is merged into stdout but only line-streamed, not buffered for failure reporting). | Capture stderr separately, include `returncode` in the final error event. |
| **N10** | Minor | [`src/app/actions/generate-designs.ts:47-48`](src/app/actions/generate-designs.ts#L47-L48) | `referenceTiktok` is passed to Python subprocess via `["--reference", value]`. Array form blocks shell injection, but argparse won't catch a value starting with `--`. Same family as N1, lower exposure. | Validate the value is a TikTok URL host before spread. |
| **N11** | Minor | [`src/lib/orchestrator.ts:4`](src/lib/orchestrator.ts#L4) | Lint reports `attachStepLogger` as unused; grep shows it IS used at line 49. Likely a stale ESLint cache. | Re-running lint on a clean tree will probably clear it; harmless. |

### Claims rejected during triage
- "Hydration mismatch in `ContentCalendar`" — false. Server returns `null`, client first render also returns `null` (state is `null`); the `startTransition`-wrapped `setWeekStart` populates *after* hydration. No mismatch.
- "Stale closure in `drainTypeQueue`" — false. Already mitigated by `drainRef` pattern at [OnboardingFlow.tsx:86-108](src/components/OnboardingFlow.tsx#L86-L108) (landed in Phase 1).
- "EventSource leaked when `runId` changes in `LiveGraph`" — false. The effect at [LiveGraph.tsx:189-201](src/components/LiveGraph.tsx#L189-L201) has `[runId]` in its deps; React tears the previous effect down (calling `es.close()`) before re-running.
- "CORS too permissive on `/generate`" — partly true (N7), but origin is correctly locked to `localhost:3000` per `main.py:14`.

### Lint warnings (cleanup candidates)
- `src/components/LiveGraph.tsx:5` — unused `GraphEdge` import
- `src/lib/hog/transformer.ts:4` — unused `slugify` import
- `src/lib/graph-bus.ts:65` — stale `eslint-disable no-var` directive
- `src/lib/orchestrator.ts:4` — see N11
- `src/components/ContentStudio.tsx:213` — `<img>` instead of `next/image`
- `src/components/KnowledgeGraph.tsx:665` — unnecessary dep on `useCallback`

---

## 2026-05-16 — Routed architecture merge (Phases 1–3)

Closed out PR #6 (Mustafa's `routed-architecture` rework, 11 commits, 4647 +/- 787 lines) and re-landed the work as three focused PRs after three rounds of review. PR #6 was force-rolled-off `main` and archived on the `routed-architecture` branch before re-landing.

### Reviews on PR #6
Three rounds posted as inline PR comments. Cumulative tally: **10 blockers, 17 majors, 12 minors**.

- Round 1 — security/correctness pass focused on `state.ts`, `scrapeSite`, lint errors, memory leaks. ([comment](https://github.com/mustafa-nom/yc-gstack-hackathon/pull/6#issuecomment-4468527398))
- Round 2 — multi-tenant state, SSE concurrency, Three.js disposal, hardcoded localhost. ([comment](https://github.com/mustafa-nom/yc-gstack-hackathon/pull/6#issuecomment-4468536367))
- Round 3 — `gbrain` subprocess layer, HOG worker pipeline, prompt-injection from scraped sites. ([comment](https://github.com/mustafa-nom/yc-gstack-hackathon/pull/6#issuecomment-4468545509))

### Merges (in order)

**[#7 — Phase 1: gbrain + knowledge graph](https://github.com/mustafa-nom/yc-gstack-hackathon/pull/7)** (merge `cf4ee04`)
- Imported gbrain subprocess client, HOG worker/transformer, agents, orchestrator, graph-bus, SSE route, LiveGraph, server actions for onboarding.
- Carousel/calendar surface deferred; AgentLogPanel "Generate" / "Push" buttons stubbed.
- Provider auto-select helper `src/lib/agents/model.ts` — Anthropic if `ANTHROPIC_API_KEY` set, else OpenAI.
- LiveGraph renders as fixed-inset background during the scanning step (matches main's original UX).
- Fixed: A1 path traversal (`state.ts` `resolveSafe`), A2 SSRF in `scrapeSite` (denylist + manual-redirect re-validation), A3 `drainTypeQueue` TDZ, B1/B2/F1 60s post-run cleanup, B3 unified SSE teardown, I1 `await transformAndWrite` before `nicheReady`.
- Live fixes: dropped Zod `.url()` then converted `.optional()` → `.nullable().transform` on LLM-emitted schemas for OpenAI strict-mode compatibility.

**[#8 — Phase 2: ContentStudio + /content](https://github.com/mustafa-nom/yc-gstack-hackathon/pull/8)** (merge `f6f974b`)
- `ContentStudio.tsx`, `carousel-prefetch.ts`, `generate-designs` server action.
- New `/content` route: thin wrapper reading `.brainpost/user.json` instead of the Phase 3 performance fixture.
- AgentLogPanel un-stubs `generateDesigns`.
- Fixed: E3 hardcoded `http://localhost:8000` → `NEXT_PUBLIC_CAROUSEL_API_BASE` env var.

**[#9 — Phase 3: ContentCalendar + /performance + push](https://github.com/mustafa-nom/yc-gstack-hackathon/pull/9)** (merge `6bb65a3`)
- `ContentCalendar`, `PerformanceLoop`, `/performance` route.
- Server actions: `performance`, `regenerate`, `push-to-tiktok`, `insights` (+ `lib/agents/insights.ts`).
- AgentLogPanel un-stubs `pushToTiktok`.
- Fixed: A4 ContentCalendar cascading `setState` in mount effect — refactored to nullable `weekStart` populated via `startTransition`.

### Build state at end of session
- `npx tsc --noEmit`: clean
- `npm run lint`: 0 errors, 5 minor warnings (4 pre-existing in `KnowledgeGraph.tsx` / `ContentStudio.tsx`, 1 unused import)

### Known deferred items
File these as issues when ready to address.

| ID | Severity | Description |
|---|---|---|
| E1 | Blocker | `runId` lives in `localStorage` — leaks across tabs/users on shared browsers. Move to `httpOnly` cookie. |
| E2 | Major | Server actions have no auth, idempotency, or rate limit. Single-tenant assumption is not enforced. |
| E4 | Major | `LiveGraph` reheats the d3 force sim on every flush. Port the pin-settled-nodes pattern from `KnowledgeGraph.tsx`. |
| F2 | Major | SSE replay produces duplicate log lines on EventSource reconnect. Add `seq`-based dedup via `Last-Event-ID`. |
| F3 | Major | SSE client opens *after* server action returns; race today masked only by the buffer leak. Open `EventSource` before the action call. |
| F5 | Major | `LiveGraph` creates Three.js geometries/textures per node without disposal on unmount. |
| F6 | Minor | New `/graph`, `/content`, `/performance` routes lack `error.tsx` for graceful crash handling. |
| I2 | Blocker | Prompt injection from scraped sites into ICP agent ([`icp.ts:38-46`](src/lib/agents/icp.ts#L38-L46)). Wrap `websiteContent` in delimited `<scraped_content>` tags with an untrusted-data system prompt instruction. |
| J1 | Major | `synthesizeStrategyFromCaptions` has no `AbortSignal`. Tab close keeps burning Claude tokens through every remaining niche. |
| J2 | Major | `gbrain.ts` double-serializes calls (global queue + per-slug mutex). The per-slug mutex never gates anything. Drop one. |
| J3 | Major | `gbrainDetached` swallows non-transient errors with only `console.error` — no signal to orchestrator or UI. |
| J5 | Major | ICP defaults to opus-4-7. Switch default to Haiku — ICP is a structured classification task. |
| C–K | Minor | Unused imports, `<img>` instead of `next/image`, two truncation-length mismatches in `scrapeSite`/`icp.ts`. |

### Branches still on origin
- `routed-architecture` — archive of original PR #6 work; superseded.
- All three Phase branches deleted on merge.
