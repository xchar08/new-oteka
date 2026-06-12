---
target: dashboard
total_score: 20
p0_count: 1
p1_count: 4
timestamp: 2026-06-11T04-51-58Z
slug: src-app-dashboard-page-tsx
---
# Critique: Dashboard (`src/app/dashboard/page.tsx`)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Good loading/optimistic-sync states, but full-screen spinner (no skeletons) and tab/date state lost on return |
| 2 | Match System / Real World | 1 | "Metabolic Score" is a fabricated number; "Bio-Efficiency", "Molecular Scaffolding", "Awaiting solar data", "Samples" are jargon walls |
| 3 | User Control and Freedom | 2 | No way to delete/edit a logged meal from the feed; calibration sliders lock permanently after one submit; modal has no Esc |
| 4 | Consistency and Standards | 2 | Numerals randomly mono vs proportional; hardcoded `#1a1206`, `green-500`, `rgba(255,140,0,…)` break the four-channel theme system; "Hub" names two different screens |
| 5 | Error Prevention | 2 | No guardrails needed here, but nothing prevents misreading the fake score as real data |
| 6 | Recognition Rather Than Recall | 2 | Tappable micros row has zero affordance it opens a modal; icon-only settings/avatar buttons |
| 7 | Flexibility and Efficiency | 2 | Logs tab can only show the current week — no path to prior weeks; time-range presets are good |
| 8 | Aesthetic and Minimalist Design | 2 | ~15 tracked-uppercase eyebrows flatten hierarchy; decorative blur orbs and watermark icons compete with data |
| 9 | Error Recovery | 1 | Insights query failure silently shows the "Awaiting solar data..." empty state — an error disguised as no-data |
| 10 | Help and Documentation | 3 | NutrientInfoModal education layer is genuinely strong contextual help |
| **Total** | | **20/40** | **Acceptable — significant improvements needed** |

## Anti-Patterns Verdict

**LLM assessment:** The Solar Instrument identity is real and partially lands (the gauge, the HUD voice, optimistic sync). But the surface fails the product slop test on density of tells: tracked-uppercase micro-eyebrows on virtually every element (~15 per screen vs. the design system's one-per-screen rule), a gradient-stroked hero gauge feeding a **fabricated metric**, identical stat-card pairs in Insights (the hero-metric template), decorative motion (settings icon rotates 90° on hover, FAB rotates), and systematic opacity-stacked muted text. A fluent user of Linear/Apple Health-grade tools would pause at the fake score first and the unreadable 8px/40%-opacity labels second.

**Deterministic scan:** `detect.mjs` ran over all 5 surface files and returned **0 findings**. This is a coverage gap, not a clean bill: the detector reads static markup patterns, and this surface builds its classes dynamically in TSX (`opacity-40`, arbitrary values, conditional strings), which evades it. No false positives; the manual review stands alone here.

**Visual overlays:** Skipped — `/dashboard` is auth-gated by the global AuthGuard (`PROTECTED_ROUTES`), no dev server was running, and no test credentials exist in this session. No user-visible overlay is available; fallback signal is source-level review only.

## Overall Impression

A committed, characterful instrument panel undermined by one integrity bug and a hundred small whispers. The bones are good — the calibration loop is real product thinking — but the hero of the screen lies (88 + streak, "Excellent", hardcoded), and the type system shouts everything in 8–10px all-caps at 30–50% opacity, so nothing reads as important and much of it is illegible. Fix honesty and legibility and this jumps a full band.

## What's Working

1. **The post-meal calibration loop** (0–30m "digesting" countdown → 30–180m rate-your-meal prompt) is time-aware, peak-end-aware engagement design that most trackers don't attempt.
2. **The NutrientInfoModal education layer** — tap any nutrient for benefits/sources/DV progress — is recognition-over-recall done right and teaches the domain.
3. **The gauge as instrument** (tick track, recessed channel, glowing rounded-cap arc) plus optimistic-sync spinners on log cards genuinely deliver the "Solar Instrument" concept.

## Priority Issues

- **[P0] The Metabolic Score is fabricated.** Line 314 renders `88 + streak_count` (or 88), labeled "Excellent" unconditionally; it can exceed 100. For precision-focused users, the moment they notice (two logged meals, score still "Excellent 88") all trust in the engine's real numbers dies. **Fix:** make the gauge tell the truth — either bind it to what it visually already shows (calorie progress: "1,842 / 2,260 kcal") or compute a real adherence score; derive the verdict label from the value. **Command:** /impeccable polish
- **[P1] Systematic contrast failure: opacity-stacked muted text.** `text-[var(--text-secondary)]` at `opacity-30/40/50` on 8–10px labels — including the interactive Scan/Plan/Shop labels (10px, 40% opacity ≈ far below 4.5:1) and every gauge sublabel. Also token-level: white text on Solar Flare `#F07F13` is ~2.7:1, failing even large-text 3:1 on the active tab (10px bold) and primary buttons. **Fix:** full-opacity muted tokens everywhere; bump tiny labels to ≥11px; darken the on-primary surface or use deep-umber text on orange. **Command:** /impeccable audit (verify full extent) → polish
- **[P1] NutrientInfoModal is theme-broken.** Surface is hardcoded `#1a1206` (dark) while headings use `var(--text-primary)` — in light mode that's near-black text on near-black background: unreadable. Hardcoded `rgba(255,140,0,…)` glows and `green-500` bars also break the Channel Rule (emerald/cobalt/midnight themes keep orange glows). **Fix:** tokens throughout (`--bg-surface`, `--success`, `rgba(var(--ring),…)`). **Command:** /impeccable polish
- **[P1] Eyebrow saturation has flattened hierarchy.** ~15 tracked-uppercase microlabels per screen (vs. the One HUD Rule: one per screen) means the calibration prompt, the macro targets, and decorative captions all speak in the same voice. **Fix:** keep one HUD kicker in the header; demote section labels to sentence-case 13px/600; let weight and size carry hierarchy. **Command:** /impeccable typeset
- **[P1] Errors masquerade as empty states; loading blocks everything.** Insights `supabase` failure silently bails, leaving the "Awaiting solar data..." empty state (a lie on error, with no retry). Initial load is a full-screen spinner instead of the design system's skeleton shimmer. Reduced-motion is also not actually honored: the global CSS override doesn't touch framer-motion's JS-driven springs. **Fix:** explicit error state with retry; skeleton layout for first paint; `useReducedMotion()` from framer-motion. **Command:** /impeccable harden

## Persona Red Flags

**Sam (Accessibility-Dependent):** The avatar "button" is a clickable `<div>` — unreachable by keyboard, no role, no label. Settings and FAB buttons are icon-only with no `aria-label`. The micros row triggers a modal from plain `<div onClick>`. Tab bar has no `role="tablist"`/`aria-selected`. Modal lacks `role="dialog"`, focus trap, and Esc. Framer-motion springs ignore `prefers-reduced-motion`. Sam cannot complete the primary review flow keyboard-only.

**Casey (Distracted Mobile User):** Interrupted mid-session, returns: active tab AND selected date silently reset to defaults — context lost. On the hub, the primary "Scan" action is a 64px tile mid-scroll, not in the thumb zone (the FAB exists only on the Logs tab). On 3G, first paint is a full-screen spinner with zero content. The micros tap targets are ~30px text rows.

**Devon (Quantified-Self Optimizer — project persona from Design Context):** Will catch the fake score within a day (logs nothing, still "88 Excellent"). Will notice Insights averages divide by the full time range rather than days-with-data, deflating his real numbers. Will see calories in mono on one card and proportional figures on the next. Each one chips away at the engine's credibility — the product's core asset.

## Minor Observations

- `weekDates` memo depends on a `today = new Date()` recreated every render — the memo never holds; minor wasted work each render.
- Numerals violate the Instrument Numeral Rule inconsistently: gauge and micros are tabular, macro cards and Insights stats are proportional `font-black`.
- Decorative motion (settings rotate-90 hover, FAB rotate, `whileHover scale 1.1`) and the header slide-in on load are product-register bans.
- BottomNav labels `/dashboard` as "Hub" while `/hub` is a separate "Control Center" — one name, two destinations.
- Empty Meal Feed says "No meals logged for this day" with no CTA, while a disconnected FAB floats nearby.
- `AnimatePresence mode="wait"` adds a dead gap on every tab switch.
- Streak chip + Crown chip are fine individually; with the fake "Excellent" verdict the cluster reads as hollow gamification — exactly the anti-reference.

## Questions to Consider

- What if the gauge simply told the truth? "1,842 of 2,260 kcal" is already more instrument-like than an invented score.
- If every label whispers in all-caps, what voice is left for the one moment that matters (a guardrail warning)?
- Should this screen be three tabs at all — or should Logs fold into History and Insights into Analytics, letting the hub breathe as a true cockpit?
- Casey is standing at a food truck: how many seconds from opening the app to a logged meal, and what on this screen is helping?
