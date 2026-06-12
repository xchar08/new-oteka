---
target: dashboard
total_score: 28
p0_count: 0
p1_count: 2
timestamp: 2026-06-11T15-16-05Z
slug: src-app-dashboard-page-tsx
---
# Critique: Dashboard (`src/app/dashboard/page.tsx`) — run 2, post polish/typeset/harden

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Skeletons, error/empty states, optimistic sync, live kicker — but tab/date state still resets on remount |
| 2 | Match System / Real World | 3 | Gauge is honest ("1,842 of 2,000 kcal"), "per logged day" labeling truthful; light brand fiction remains deliberately |
| 3 | User Control and Freedom | 2 | Still no edit/delete on logged meals; calibration sliders lock permanently after one submit |
| 4 | Consistency and Standards | 3 | Tokens and mono numerals unified; one type ramp; remaining: "Hub" names two screens, dual nav paradigms |
| 5 | Error Prevention | 3 | Honest data prevents misreading; double-submit guarded |
| 6 | Recognition Rather Than Recall | 3 | Dotted-underline affordance on tappable nutrients, labeled icon buttons |
| 7 | Flexibility and Efficiency | 2 | Logs still locked to current week; no deep-linkable tabs |
| 8 | Aesthetic and Minimalist Design | 3 | Eyebrows collapsed to one kicker, hierarchy real; decorative blur orbs remain but balanced |
| 9 | Error Recovery | 3 | Insights failure → retry card with role="alert"; page-level hook failures still unhandled upstream |
| 10 | Help and Documentation | 3 | Nutrient education modal now never dead-taps; fallback for unknown nutrients |
| **Total** | | **28/40** | **Good — solid foundation, address weak areas** |

## Anti-Patterns Verdict

**LLM assessment:** The screen now passes the product slop test it failed before. The fabricated metric is gone — the hero gauge reads real kcal in instrument numerals with a derived status. The ~15 tracked-uppercase eyebrows are down to exactly one deliberate HUD kicker ("Live console"); section structure is carried by a quiet 13px sentence-case ramp. Numerals are uniformly mono tabular. Decorative motion (rotating settings icon, bouncing FAB) is gone; entrances are crisp ease-out and collapse under reduced motion. The glass log card became an opaque surface per the Earned Glass Rule. Residual tells are mild: the Insights stat-card pair is still structurally the big-number-small-label template (now with honest data), and the surface remains card-stacked.

**Deterministic scan:** 0 findings across 6 files — consistent with run 1's known TSX coverage limitation, so no delta signal either way. No false positives.

**Visual overlays:** Skipped again — auth-gated route, no dev server, no credentials. Source-level review only; same fallback as run 1.

## Overall Impression

This now reads like a designed instrument rather than generated scaffolding. The data is honest, the hierarchy whispers and points, the states (loading/error/empty) are all real. What's left is interaction depth, not surface: state persistence across interruptions, keyboard completeness on the one remaining clickable div, and the locked-to-this-week logs view.

## What's Working

1. **The honest gauge** — real consumed kcal in 5xl mono, "of 2,000 kcal", status derived from actual progress, and an SVG `aria-label` announcing the same numbers. Trustworthy and more instrument-like than the fake score ever was.
2. **A real typographic hierarchy** — one HUD kicker, 13px sentence-case section labels, 11px captions, mono data. The calibration prompt now visually outranks decoration.
3. **State coverage** — skeleton first paint with `role="status"`, an insights error card with retry (`role="alert"`), empty states with CTAs, optimistic-sync indicators, and reduced-motion handled at the framer-motion level, not just CSS.

## Priority Issues

- **[P1] The calibration rating banner is still a clickable `<div>`.** The 30–180m "Calibrate {meal}" card — the product's signature engagement loop — has `onClick` on a `motion.div` with no role, tabIndex, or key handling. Keyboard and switch users cannot rate meals from the dashboard. **Fix:** render as a button (or add role="button" + tabIndex + Enter/Space). **Command:** /impeccable polish
- **[P1] Interruption still loses context.** `activeTab` and `selectedDate` reset to defaults on every mount. Casey returns from a text message to the Hub tab and today's date regardless of where she was. **Fix:** mirror `activeTab` to the URL (`?tab=logs`) or sessionStorage; keep `selectedDate` with it. **Command:** /impeccable harden
- **[P2] Tablist is ARIA-shaped but not keyboard-complete.** `role="tablist"`/`aria-selected` exist, but there's no arrow-key navigation, no roving tabindex, no `aria-controls`/`role="tabpanel"` wiring. **Command:** /impeccable audit → harden
- **[P2] Logs are locked to the current week.** The date strip can't reach last week; no link to History from the meal feed. Alex hits a wall on day 8. **Fix:** chevron to previous weeks or a "View history" link under the feed. **Command:** /impeccable shape (small flow change)
- **[P2] "Over budget" fails small-text contrast.** `--error` #D14D41 at 11px bold is ~4.0:1 on the white card. The one place stakes are communicated misses AA by a hair. **Fix:** add `--error-text` (e.g. #AA3B2F, ~5.8:1) mirroring the `--primary-text` pattern. **Command:** /impeccable polish

## Persona Red Flags

**Sam (Accessibility-Dependent):** Vastly better — labeled buttons, dialog semantics with focus trap, real disclosure buttons, status/alert regions. Two remaining blocks: the rating banner div (cannot rate a meal keyboard-only from here) and tab switching requires clicking each tab (no arrow keys).

**Casey (Distracted Mobile User):** Skeleton first paint and the empty-state "Scan a meal" CTA help. Still loses her place on interruption (tab + date reset), and on the Hub the scan action remains a mid-scroll tile while the FAB only exists on Logs.

**Devon (Quantified-Self Optimizer):** The fixes were aimed at him and they land — real gauge, per-logged-day averages with explicit labels, uniform tabular mono. Remaining nit: he can't audit beyond the current week from this screen, and totals/averages still derive solely from `metabolic_tags_json` (whatever the vision pipeline wrote, ungrounded against `grams`).

## Minor Observations

- The digesting banner's progress strip and the calibration card's `whileHover` scale aren't reduced-motion gated (the only two framer animations missed).
- Heading levels skip (h1 → h3 "Daily energy" on the Hub tab).
- `AnimatePresence mode="wait"` still adds a small dead gap between tab switches.
- Insights stat cards render "0" briefly alongside the empty state when a range has no logs — slight redundancy.
- The streak chip applies `tabular-nums` to Schibsted, which may not carry the feature (harmless).
- `as any` casts remain in the calibration-banner tag checks and `filteredMacros` vitamin records (pre-existing data-layer typing).

## Questions to Consider

- Should `?tab=` be the model for every multi-view screen in the app, so interruption-resilience is a convention rather than a per-page fix?
- The calibration loop is the product's best idea — does it deserve to survive past the 180-minute window as a quiet inbox item instead of vanishing?
- If Logs grew a week-pager, would the separate History page still need to exist?
