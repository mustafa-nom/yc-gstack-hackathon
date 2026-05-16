@AGENTS.md

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # start dev server at localhost:3000
npm run build    # production build
npm run lint     # run ESLint
```

No test suite exists yet.

## Architecture

**BrainPost** is a Next.js 16 app (App Router) with a two-phase UI:

1. **Onboarding** (`OnboardingFlow`) — multi-step wizard that collects: product website, description, target audience, and a reference TikTok URL. On completion it runs a simulated agent pipeline (typewriter log animation) and generates a `personal.md` profile. All state is local to this component; there is no backend yet — the "scanning" step is entirely client-side animation.

2. **Dashboard** (`Dashboard`) — tab-switched between two views:
   - **Content Studio** (`ContentStudio`) — displays hardcoded strategy cards and a 7-slide carousel. "Regenerate" and "Export" buttons are stubs.
   - **Performance Loop** (`PerformanceLoop`) — displays hardcoded post performance rows and an AI learning summary. All data is static.

**Routing**: single route (`/`). Phase is toggled via React state in `page.tsx`, not via URL navigation.

**Styling**: Tailwind CSS v4 with `@theme inline` in `globals.css`. All design tokens (`--accent`, `--card-bg`, `--muted`, `--success`, `--danger`, `--subtle`) are CSS variables defined in `:root` and exposed as Tailwind color utilities. Dark mode only — no light mode.

**Fonts**: Geist Sans + Geist Mono loaded via `next/font/google` in `layout.tsx`.

**Smooth scroll**: Lenis is initialized in `page.tsx` via `useEffect` and runs a `requestAnimationFrame` loop for the lifetime of the page.

**Animations**: `motion/react` (re-export of framer-motion v12) is used for page transitions (`AnimatePresence`), entrance animations, and the progress bar. The standard easing used across the app is `[0.16, 1, 0.3, 1]`.

## Next.js version note

This project uses Next.js **16** — read `node_modules/next/dist/docs/` before writing any Next.js-specific code. APIs and conventions may differ significantly from earlier versions.
