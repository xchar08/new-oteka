# Product

## Register

product

## Users

Health-conscious optimizers — quantified-self and biohacking-minded people who want precise metabolic data and control, not hand-holding. They use Oteka on their phone, usually one-handed and mid-task: scanning a plate with the camera before eating, checking the meal plan in a grocery aisle, glancing at the dashboard between sets. Sessions are short and frequent; the job is "log this with zero friction and tell me what it means."

## Product Purpose

Oteka is a metabolic optimization engine delivered as a mobile-first app (Next.js PWA + Capacitor for Android/iOS). Core loop: vision-based food logging (camera → volumetric calorie/macro estimation), WASM-powered meal-plan optimization, pantry inventory with probability-decay tracking, shopping lists, menu scanning for eating out, an AI coach, and household/social features. Medical safety guardrails (user-declared conditions constrain every AI recommendation) are a core differentiator, not a settings afterthought. Revenue is a Stripe-backed premium tier. Success looks like: logging is effortless enough to happen every meal, and users trust the engine's recommendations enough to act on them.

## Brand Personality

Modern, Minimalist, Precision-Focused.

The established voice is the "Solar Instrument": a warm precision instrument for your own biology — cockpit confidence, not hospital sterility. Data reads like instrument gauges (tabular numerals, calm hierarchy), and the light sci-fi register (Control Center, system readouts) signals capability. The warmth in the palette keeps it human; the precision in the type keeps it credible.

## Anti-references

- **MyFitnessPal-style trackers** — cluttered logging lists, ad-saturated screens, dated calorie-counter density, endless settings mazes.
- **Clinical/medical portals** — sterile whites, dense gray forms, insurance-software lifelessness. Trust must come from clarity, not bureaucracy.
- **Gamified fitness apps** — confetti, badges, streak-shaming, mascots, loud motivational gradients. Oteka motivates with data, not noise.
- **Generic SaaS dashboards** — interchangeable stat-card grids, purple gradients, hero-metric templates. The instrument-panel voice must stay specific, not template-flavored.

## Design Principles

1. **Instrument, not spreadsheet.** Data is read at a glance, like a gauge: one number that matters, context around it. Precision is conveyed by typography (tabular numerals, aligned readouts) and hierarchy, never by cramming.
2. **Disappear into the log.** The capture flows (vision scan, pantry, menu) are the product's heartbeat. Every tap between intent and a logged meal is friction to eliminate; optimistic UI over loading states.
3. **Earned trust over decoration.** Medical guardrails and AI recommendations carry real stakes. Their presentation is calm, legible, and unambiguous — the sci-fi voice never gets to undermine the credibility of health data.
4. **Thumb-first.** One hand on a phone is the default posture. Primary actions live in the thumb zone, navigation is bottom-anchored, and reach is part of every layout decision.
5. **Quiet premium.** The paid tier is communicated through capability and restraint — locked features explain their value plainly. No upsell confetti, no nag patterns.

## Accessibility & Inclusion

WCAG 2.1 AA baseline: ≥4.5:1 body-text contrast (≥3:1 for large text), visible focus indicators, full `prefers-reduced-motion` alternatives (partially in place in globals.css), and keyboard operability on web. On top of AA: deliberate one-handed mobile design — touch targets ≥44px, primary actions reachable in the thumb zone, bottom-anchored nav, and safe-area-inset handling for notched devices (already established via `pt-safe`/`pb-safe` utilities).
