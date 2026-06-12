---
target: dashboard
total_score: 35
p0_count: 0
p1_count: 0
timestamp: 2026-06-11T20-44-39Z
slug: src-app-dashboard-page-tsx
---
# Critique: Dashboard (`src/app/dashboard/page.tsx` + composed surface) — run 4, post meal-editing

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 4 | Every data path now has honest loading/error/sync states including the gauge; state persists; insights refetches per tab visit (run-3's staleness concern was wrong) |
| 2 | Match System / Real World | 3 | Honest numbers throughout; "Scales every nutrient proportionally" slightly overpromises (micros amount strings don't scale, only DV%) |
| 3 | User Control and Freedom | 4 | Edit, portion rescale, exact overrides, delete + undo, re-rate calibration — the three-run control gap is closed |
| 4 | Consistency and Standards | 4 | Edit form reuses the established input/button/disclosure vocabulary; provenance chip; uniform retry/skeleton patterns |
| 5 | Error Prevention | 3 | Name validation, clamps, disabled states, undo — but switching dashboard tabs mid-edit silently discards a draft, and Esc discards without warning |
| 6 | Recognition Rather Than Recall | 3 | "Edited" provenance, labeled disclosure, lock-dot forewarning; manage actions are one expansion deep (conventional) |
| 7 | Flexibility and Efficiency | 4 | Week paging, deep links, arrow-key tabs, portion stepper, full nutrient control, re-rating — multiple paths, real power features |
| 8 | Aesthetic and Minimalist Design | 3 | Edit form is clean and progressive; decorative orbs and card-stack density remain (accepted identity) |
| 9 | Error Recovery | 4 | Every failure path recovers honestly: gauge/week/insights retry cards, save keeps the form, delete restores on failure, undo verifies via refetch |
| 10 | Help and Documentation | 3 | Nutrient education modal, plain-language upgrade dialog; no inline help for the calibration concept |
| **Total** | | **35/40** | **Top of Good — one point from Excellent** |

## Anti-Patterns Verdict

**LLM assessment:** The meal-editing build holds the line. The edit form is the disclosure pattern done properly — name + portion by default, exact nutrients folded away — rather than the MyFitnessPal field-wall the anti-references prohibit. Inputs are the established sunken wells, numbers stay mono, destructive action is quiet ghost + undo rather than red-button theater, and provenance ("Edited") is instrument honesty. No bans triggered. The surface remains recognizably the Solar Instrument across four rounds of heavy change — which is what a design system is for.

**Deterministic scan:** 0 findings across 8 files — consistent TSX coverage limitation across all four runs; no delta signal, no false positives.

**Visual overlays:** Skipped — auth wall, no dev server, no credentials. All four runs are source-level; the un-validated remainder (touch feel, real layout, live theming) is concentrated in the same caveat.

## Overall Impression

Four rounds: a fabricated hero metric and fifteen shouting eyebrows became an honest instrument with a navigable timeline, complete state coverage, keyboard-operable everything, and now user-correctable data with visible provenance. The remaining findings are second-order interaction guards (draft loss on tab switch, focus hand-off into the form) — the kind of issue that only exists because the first-order work is done.

## What's Working

1. **The edit flow respects both audiences** — one-tap portion fix for the casual correction, exact overrides for Devon, neither in the other's way. Hand-edited values becoming the new scaling base is the right mental model.
2. **Destructive action done right** — instant optimistic removal, undo toast, delete-then-restore sequencing that can't race, and failure paths that re-verify against the server instead of guessing.
3. **Provenance as a brand idea** — the "Edited" pencil chip turns data honesty into visible instrument language; AI estimate vs. user correction is legible at a glance.

## Priority Issues

- **[P2] Tab-switch mid-edit silently discards the draft.** The Logs panel unmounts on tab change, taking unsaved edit state with it — no warning, no recovery. **Fix:** block tab switching while `isEditing` (with a toast), or lift/persist the draft. **Command:** /impeccable harden
- **[P2] Focus is dropped entering edit mode.** "Edit meal" unmounts beneath the keyboard user; focus falls to `<body>`. **Fix:** focus the name input on `beginEdit`, return focus to the manage row on cancel/save. **Command:** /impeccable polish
- **[P3] Esc discards typed values instantly** — consistent with dialogs but unguarded for a form with real work in it; consider confirming when the draft is dirty.
- **[P3] Portion caption overpromises** — "Scales every nutrient proportionally" while vitamin/mineral *amount strings* stay fixed (only DV% scales). Tighten the copy ("Scales calories, macros, and daily values").
- **[P3] Edited vitamin amounts save as strings** even when originally numeric — harmless to every current reader, but a quiet data-type drift worth normalizing at save.

## Persona Red Flags

**Sam (Accessibility-Dependent):** The form itself is properly labeled (htmlFor, aria-labels on per-nutrient inputs, aria-expanded disclosure, real buttons with disabled states) — but the entry transition drops focus (P2 above), which is the difference between accessible markup and an accessible flow.

**Casey (Distracted Mobile User):** Undo-delete is built for her. The draft-loss-on-tab-switch is her failure mode exactly — interrupted mid-edit, taps Hub reflexively, work gone.

**Devon (Quantified-Self Optimizer):** This round was for him: exact overrides, visible provenance, corrections propagating instantly to the gauge. Remaining asks are export and adding a missing nutrient row — feature territory, not defects.

## Minor Observations

- Run-3 correction: insights does refetch on every tab visit (`activeTab` is an effect dep) — the "accepted staleness" note in the previous snapshot was inaccurate.
- No add/remove rows in the nutrient editor (can only correct existing entries) — deliberate v1 scope.
- The remaining unvalidated risk across all four runs is the same: no live render has ever been seen. The score's last points live there, not in the source.

## Questions to Consider

- Should "dirty draft" become a first-class concept (guarding tab switches, navigation, and Esc uniformly) rather than three separate guards?
- Is export (CSV/HealthKit) the next Devon feature now that the data is correctable and trustworthy?
- Four runs of source-only critique have converged — is the next evaluation a live `/impeccable audit` with the dev server and a test login?
