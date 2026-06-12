---
title: 'Dashboard hardening decisions (insights avgs, modal trap, motion)'
type: document
status: published
version: 2
created_at: '2026-06-11T15:04:21.175Z'
tags:
  - '#conventions'
  - '#a11y'
  - '#architecture'
updated_at: '2026-06-11T15:04:21.185Z'
checksum: 'sha256:bd3fbf2b5ee3aaa541d59202c477d75d2719398c14d556633dc1bec54469ee3c'
---

# Dashboard hardening decisions (insights avgs, modal trap, motion)

From the 2026-06-11 `/impeccable harden dashboard` pass. Three decisions future sessions should know about:

1. **Insights averages are per *logged* day, not per calendar day.** The query now selects `local_date`, counts distinct logged days, and divides totals by that (`src/app/dashboard/page.tsx`). Labels say "kcal per logged day" / "per logged day". Rationale: sparse logging shouldn't deflate the numbers a user actually recorded. Don't revert to dividing by the time-range length without relabeling.
2. **NutrientInfoModal never dead-taps.** Nutrients missing from `NUTRIENT_DATABASE` (e.g. Sodium, Cholesterol — passed by the dashboard micros bar) get a fallback modal ("reference data on the way") instead of returning null. The modal also owns a manual focus trap (focus on open, Tab cycling, focus restore on close) — if a headless-UI dialog lib is ever adopted, this hand-rolled trap is the thing to replace.
3. **framer-motion must opt into reduced motion explicitly.** The global CSS `prefers-reduced-motion` override does NOT affect framer-motion's JS-driven animations. Convention: every component with framer variants calls `useReducedMotion()` and collapses variants/transitions to opacity-or-nothing. Done in dashboard page, LogEntryCard, NutrientInfoModal. Entrance variants are defined *inside* components for this reason — don't hoist them back to module scope.

Also: LogEntryCard's variants needed a `show` key matching the dashboard container's animate label — child variants missing the parent's label silently stay hidden (latent framer-motion gotcha). Loading is skeleton `.shimmer` blocks with `role="status"`, never full-screen spinners; insights failures render a retry card (`role="alert"`), never the empty state.

**Multi-view state convention (added in the second harden pass):** in-page view state survives interruptions. The dashboard mirrors its active tab to `?tab=` via `URLSearchParams` + `history.replaceState` — NOT `useSearchParams`, which would force a Suspense boundary under this app's Capacitor static export. Lazy `useState` initializers read the URL/sessionStorage with `typeof window` guards (safe because first paint is the loading skeleton on both server and client). `selectedDate` persists to sessionStorage but is only restored when its Monday matches the current week (the strip can't show other weeks). Tabs implement the full ARIA pattern: roving tabindex, ArrowLeft/Right/Home/End, `aria-controls` ↔ `role="tabpanel"`/`aria-labelledby`. Treat `?tab=` as the convention for any future multi-view screen.
