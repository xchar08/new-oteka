---
title: Design doctrine set at impeccable init (June 2026)
type: document
status: published
version: 2
created_at: '2026-06-11T04:33:42.500Z'
tags:
  - '#architecture'
  - '#design-system'
  - '#conventions'
updated_at: '2026-06-11T04:33:42.509Z'
checksum: 'sha256:5070aa2bc1944b9239beb7f29e798e96ad37987c61911a522b84c2891469e532'
---

# Design doctrine set at impeccable init (June 2026)

On 2026-06-10, `/impeccable init` produced `PRODUCT.md` and `DESIGN.md` at the project root (plus `.impeccable/design.json` for the live panel and `.impeccable/live/config.json` targeting `src/app/layout.tsx`). Strategic answers confirmed with the owner:

- **Register:** product. Primary users: health-conscious optimizers, one-handed mobile use.
- **Personality:** Modern, Minimalist, Precision-Focused.
- **Anti-references (all four):** MyFitnessPal-style trackers, clinical/medical portals, gamified fitness apps, generic SaaS dashboards.
- **A11y:** WCAG AA + explicit thumb-zone/one-handed design.

Two decisions deliberately **diverge from existing code**, so don't treat current patterns as canon:

1. **Motion is "precise and mechanical," not spring-bounce.** The owner chose crisp snaps with no overshoot over the existing `sprintBounce` / `pressable` overshoot easings (`cubic-bezier(0.34, 1.56, 0.64, 1)` in `globals.css`) and framer-motion springs. New work uses 150–300ms ease-out; legacy bounce is to be tightened when touched, not emulated.
2. **`.gradient-text` is deprecated.** It's still used (e.g. hub page h1) but is banned for new work; emphasis via weight/size/solid Solar Flare.

Also codified: the `.hud-label` tracked-uppercase microlabel is allowed **once per screen** as the header kicker only ("One HUD Rule"), and opacity modifiers stacked on `--text-secondary` (`opacity-60`, `/50` — common in current pages) are a contrast defect, not a pattern to copy.
