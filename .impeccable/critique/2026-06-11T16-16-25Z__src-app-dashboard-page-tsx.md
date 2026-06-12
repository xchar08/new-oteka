---
target: dashboard
total_score: 31
p0_count: 0
p1_count: 0
timestamp: 2026-06-11T16-16-25Z
slug: src-app-dashboard-page-tsx
---
# Critique: Dashboard (`src/app/dashboard/page.tsx`) — run 3, post week-navigation

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Skeletons/error/sync states everywhere and state persists — but a failed `useMetabolicLogs` fetch still silently shows "0 kcal · In budget" on the gauge |
| 2 | Match System / Real World | 3 | Honest data, conventional week label, per-logged-day labeling; light brand fiction remains deliberate |
| 3 | User Control and Freedom | 3 | Full week freedom, Today escape, deep links, dialog escapes; still no edit/delete on logged meals, calibration sliders lock permanently |
| 4 | Consistency and Standards | 4 | Tokens, mono numerals, shared dialog a11y hook, identical error/skeleton/retry patterns across tabs, complete ARIA tabs — within-surface vocabulary is now genuinely uniform |
| 5 | Error Prevention | 3 | Free boundary intercepted before fetch; forward chevron disabled; DST millisecond-math edge exists |
| 6 | Recognition Rather Than Recall | 3 | Lock dot signals the gate before tapping; Today pill appears contextually; dotted-underline info affordances |
| 7 | Flexibility and Efficiency | 3 | Week paging + deep links + arrow-key tabs + range presets; no swipe-to-page gesture on the strip yet |
| 8 | Aesthetic and Minimalist Design | 3 | Unchanged: one kicker, real hierarchy; decorative orbs and card-stack density remain |
| 9 | Error Recovery | 3 | Week and Insights both have retry cards; upstream hook failures (today-logs, advisor) have no recovery surface |
| 10 | Help and Documentation | 3 | Nutrient education modal with fallback; upgrade dialog explains the boundary plainly |
| **Total** | | **31/40** | **Good — approaching the strong end of the band** |

## Anti-Patterns Verdict

**LLM assessment:** No new tells introduced by the week-navigation build. The pager speaks the established voice (mono tabular range label, mechanical 44px chevrons, the standard lock-dot vocabulary), the upgrade dialog is quiet-premium rather than nag-pattern, and the gated boundary is intercepted before any fetch — a pattern most real products get wrong. The surface reads as designed, not generated. Residuals from prior runs stand: decorative blur orbs, card-stacked composition, and the Insights stat pair (honest data, template structure).

**Deterministic scan:** 0 findings across 7 files — same TSX coverage limitation as runs 1–2; no delta signal. No false positives.

**Visual overlays:** Skipped — auth wall, no dev server, no credentials. Source-level review only, consistent with all three runs.

## Overall Impression

Three rounds in, this is a different screen: honest hero, one kicker, uniform states, keyboard-complete tabs, interruption-proof state, and now time itself is navigable — with the previously broken past-day data path actually fixed underneath it. What's left splits cleanly into one quiet data-trust gap (the silent upstream-hook failure), one calendar-math edge, and product gaps (meal edit/delete) that belong to new feature work, not repair.

## What's Working

1. **The week pager earns its place** — fetch-per-week caching, same-weekday continuity, Today escape, deep-linkable `?date=`, and a free-tier boundary that intercepts before the network rather than after.
2. **State patterns are now a system** — the same skeleton, retry-card, and empty-state shapes appear in Logs and Insights; the same dialog a11y contract backs both modals via one shared hook.
3. **The premium gate is on-brand** — lock dot as forewarning, dialog only on explicit action, plain value copy, one CTA. Quiet Premium as specified in PRODUCT.md.

## Priority Issues

- **[P2] The hero can lie when its own fetch fails.** `useMetabolicLogs` exposes no error; if the today-logs query fails, the gauge renders "0 of 2,000 kcal · In budget" as if true. **Fix:** surface an error from the hook and give the gauge card the established retry treatment. **Command:** /impeccable harden
- **[P2] DST edge in week math.** `pageWeek` and `weekDates` use fixed-86,400,000ms arithmetic; across the fall-back weekend, `Monday 00:00 + 168h` lands on Sunday 23:00 and `mondayOf` resolves to the *prior* week — paging can no-op once a year. **Fix:** `setDate(±7)`-based date arithmetic instead of millisecond addition. **Command:** /impeccable polish
- **[P3] `useWeekLogs` fetches on the hub tab too** — a redundant (cached) query before the user ever opens Logs. Gate `enabled` on the active tab or accept the cost deliberately.
- **[P3] Week skeleton block heights only approximate the real content** — minor layout shift when content lands.

## Persona Red Flags

**Sam (Accessibility-Dependent):** Near-clean — arrow-key tabs, labeled pager buttons, `aria-live` week label, trapped dialogs, real disclosure buttons. The boundary press producing a dialog is legitimate feedback. Remaining nit: the lock dot is `aria-hidden` with no textual hint that the previous-week button is gated until activated.

**Casey (Distracted Mobile User):** State survives interruptions, Today pill recovers from time-travel, skeletons structure the wait. She would expect swipe-to-page on the strip — chevrons only, for now.

**Devon (Quantified-Self Optimizer):** Can finally audit any past day (with Pro), numbers are honest and labeled. His remaining asks are product features: edit/delete a logged meal, re-rate a calibration, export.

## Minor Observations

- `mode="wait"` tab-switch gap persists (accepted across runs).
- The "Hub" naming collision (BottomNav "Hub" → /dashboard vs the /hub Control Center page) is app-level and still unresolved.
- Pre-existing data-layer `any`s remain (calibration tag checks, vitamin records).
- Advisor quote and modal quote keep raw `"…"` characters (styling choice, flagged by lint).

## Questions to Consider

- The gauge card is the one surface without an error state — should "data freshness" become a visible instrument concept (a stale/error chip on the HUD) rather than per-card retry buttons?
- Is swipe-to-page on the date strip the next Casey win, and should it share gesture vocabulary with the tab panels?
- Meal edit/delete keeps surfacing across runs as the control-and-freedom ceiling — is that the next `/impeccable shape`?
