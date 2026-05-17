# Changelog

Engineering log of significant changes, reviews, and decisions on `main`.
Most recent at the top.

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
