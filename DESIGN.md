---
name: Oteka
description: Metabolic optimization engine — a warm OLED instrument panel for your biology
colors:
  solar-flare: "#F07F13"
  solar-flare-deep: "#D96F0B"
  solar-flare-text: "#8A4708"
  solar-halo: "#FFB347"
  daylight-bg: "#FBF6EE"
  daylight-surface: "#FFFFFF"
  daylight-surface-sunken: "#F6EEE1"
  daylight-border: "#EBDFCD"
  umber-ink: "#221A12"
  umber-muted: "#6F6052"
  oled-bg: "#0E0903"
  oled-surface: "#1A130A"
  oled-surface-raised: "#261C10"
  oled-border: "#2C2114"
  oled-ink: "#F7F2EA"
  oled-muted: "#A89B8A"
  verdant-signal: "#11A36C"
  caution-amber: "#E8A317"
  fault-red: "#D14D41"
typography:
  display:
    fontFamily: "Syne, Schibsted Grotesk, ui-sans-serif, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Syne, Schibsted Grotesk, ui-sans-serif, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.6
  label:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, sans-serif"
    fontSize: "10px"
    fontWeight: 800
    letterSpacing: "0.25em"
  data:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "0.875rem"
    fontWeight: 600
    fontFeature: "tabular-nums"
rounded:
  control: "8px"
  card: "12px"
  panel: "16px"
  dock: "28px"
  hero: "32px"
  pill: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "40px"
components:
  button-primary:
    backgroundColor: "{colors.solar-flare}"
    textColor: "{colors.umber-ink}"
    rounded: "{rounded.control}"
    height: "44px"
    padding: "8px 24px"
  button-primary-hover:
    backgroundColor: "{colors.solar-flare-deep}"
  button-secondary:
    backgroundColor: "{colors.daylight-surface-sunken}"
    textColor: "{colors.umber-ink}"
    rounded: "{rounded.control}"
    height: "44px"
    padding: "8px 24px"
  button-ghost:
    textColor: "{colors.umber-muted}"
    rounded: "{rounded.control}"
    height: "44px"
    padding: "8px 24px"
  input:
    backgroundColor: "{colors.daylight-surface-sunken}"
    textColor: "{colors.umber-ink}"
    rounded: "{rounded.control}"
    height: "48px"
    padding: "8px 16px"
  card:
    backgroundColor: "{colors.daylight-surface}"
    rounded: "{rounded.card}"
    padding: "24px"
  nav-dock:
    backgroundColor: "{colors.daylight-surface}"
    rounded: "{rounded.dock}"
    height: "68px"
  hud-label:
    textColor: "{colors.solar-flare-text}"
    typography: "{typography.label}"
---

# Design System: Oteka

## 1. Overview

**Creative North Star: "The Solar Instrument"**

Oteka's interface is a warm precision instrument — a cockpit for your own biology. The system pairs OLED-black warmth with a single saturated solar accent, instrument-grade numerals, and an atmospheric depth layer (a fixed aurora glow plus film grain) that keeps flat surfaces from feeling sterile. The personality is Modern, Minimalist, Precision-Focused: the warmth lives in the palette and the light, never in clutter or ornament.

The system explicitly rejects the four failure modes of its category: the cluttered density of MyFitnessPal-style trackers, the sterile lifelessness of clinical/medical portals, the confetti-and-mascot noise of gamified fitness apps, and the interchangeable stat-card-grid look of generic SaaS dashboards. Oteka motivates with legible data, and earns trust with calm, unambiguous presentation — especially around medical guardrails, where the sci-fi voice always yields to clarity.

This is a phone-first, one-handed product (Capacitor on Android/iOS, PWA on web). Layouts are single-column with `max-w-md` content rails, navigation is a floating bottom dock, and primary actions live in the thumb zone. Motion conveys state in 150–300ms with crisp, mechanical easing — no overshoot, no choreographed page loads.

**Key Characteristics:**
- Warm OLED dark mode and warm paper-light mode, both anchored by one solar accent
- Four user-selectable accent channels (Solar default, Emerald, Cobalt, Midnight) that swap hue without changing structure
- Instrument numerals: every number a user reads is tabular-lining mono
- Depth by light emission (glows, hairlines, blur) rather than dark shadows
- One signature caption voice: the HUD microlabel
- Thumb-first ergonomics: bottom dock, ≥44px targets, safe-area aware

## 2. Colors

A Restrained strategy: warm-tinted neutrals carry the surface; **Solar Flare** appears on well under 10% of any screen and means exactly one thing — "this is live or actionable."

### Primary
- **Solar Flare** (#F07F13): The single accent. Primary action buttons, active nav states, live indicators, focus rings, selection. Hover deepens to **Solar Flare Deep** (#D96F0B). White on Solar Flare is ~2.7:1, so **on-flare text uses `--primary-fg`** — deep umber on solar/emerald channels (6.3:1), white on cobalt/midnight.
- **Solar Flare Text** (#8A4708, `--primary-text`): Accent-colored *text and icons on light surfaces*, where raw Solar Flare fails 4.5:1. In dark mode it resolves to the bright primary (7:1 on OLED black). The same pattern exists for semantic verdicts: `--success-text` (#0B6A47) and `--error-text` (#AA3B2F) on light, resolving to the bright semantic colors in dark mode.
- **Solar Halo** (#FFB347): The accent's softer companion — aurora gradients and atmosphere only, never text or controls.

### Neutral — Daylight mode
- **Daylight** (#FBF6EE): App background, warm near-white.
- **Daylight Surface** (#FFFFFF): Cards and raised panels.
- **Daylight Sunken** (#F6EEE1): Input wells, secondary surfaces.
- **Daylight Border** (#EBDFCD): 1px hairlines on every surface.
- **Umber Ink** (#221A12): All primary text.
- **Umber Muted** (#6F6052): Secondary text — at full opacity only.

### Neutral — OLED mode
- **OLED Black** (#0E0903): App background; warm-tinted true black for OLED panels.
- **OLED Surface** (#1A130A) / **OLED Raised** (#261C10): Card and panel layers.
- **OLED Border** (#2C2114): Hairlines.
- **OLED Ink** (#F7F2EA) / **OLED Muted** (#A89B8A): Text pair; dark mode brightens semantic colors (success #3DDC97, warning #FACC15, error #F87171) to hold contrast.

### Semantic
- **Verdant Signal** (#11A36C): Success, within-target metrics, safe-to-eat verdicts.
- **Caution Amber** (#E8A317): Warnings, approaching limits.
- **Fault Red** (#D14D41): Errors and medical-guardrail violations. Reserved exclusively for stakes; never decorative.

### Named Rules
**The One Flare Rule.** The accent appears on less than 10% of any screen, and only ever means "live or actionable." If solar orange shows up as decoration, it is wrong.

**The Channel Rule.** Theme variants (`.theme-emerald` #0FA47A, `.theme-cobalt` #2F6BFF, `.theme-midnight` #8B5CF6) swap the accent channel and its tinted neutrals only. Structure, spacing, and type never change between channels — always style against `var(--primary)` and friends, never hardcoded orange.

## 3. Typography

**Display Font:** Syne (with Schibsted Grotesk fallback)
**Body Font:** Schibsted Grotesk (with system-ui fallback)
**Data Font:** JetBrains Mono

**Character:** A geometric-display + humanist-grotesk + mono triad. Syne gives headers a confident, slightly futuristic instrument-panel voice; Schibsted Grotesk keeps dense body copy legible at small mobile sizes; JetBrains Mono makes every readout feel calibrated.

### Hierarchy
- **Display** (Syne 800, 2.25rem/36px, lh 1.1, ls -0.01em): Page titles. One per screen.
- **Headline** (Syne 700, 1.5rem/24px, lh 1.2): Section and card titles (h2/h3 inherit the display face globally).
- **Section label** (Schibsted 600, 13px, sentence case, `--text-secondary`): The workhorse heading for in-page sections and card titles ("Meal feed", "Macro balance", "Daily energy"). Never uppercase, never tracked.
- **Data caption** (Schibsted 500–600, 11px, sentence case, `--text-secondary`): Tiny labels under readouts ("Remaining", "kcal / day", macro names).
- **Body** (Schibsted 500, 0.875rem/14px, lh 1.6): Default copy. Prose caps at 65–75ch.
- **Label / HUD** (Schibsted 800, 10px, uppercase, tracked 0.25em): The `.hud-label` utility — the app's signature caption voice, used ONCE per screen as the header kicker.
- **Data** (JetBrains Mono 600, tabular-nums): Calories, macros, join codes, timestamps — anything counted or measured.

### Named Rules
**The Instrument Numeral Rule.** Every number a user reads — calories, grams, percentages, timers — renders in JetBrains Mono with tabular figures. Proportional digits in a readout are a defect.

**The One HUD Rule.** The HUD microlabel is a deliberate brand system, used once per screen as the header kicker (e.g. "Neural Interface"). It is not section scaffolding: repeating tracked-uppercase eyebrows above every section is forbidden.

## 4. Elevation

Depth in Oteka comes from **light, not darkness** — the light-emission model. The base layer is atmospheric: a fixed two-point aurora gradient (`--aura-1`/`--aura-2`) breathing on a 14s loop behind every screen, with a film-grain overlay (5–7% opacity) that kills gradient banding and adds tactility. Surfaces float above it; active elements emit.

### Shadow Vocabulary
- **Hairline highlight** (`inset 0 1px 0 rgba(255,255,255,0.06)`): Top edge of glass panels — light catching a beveled instrument edge.
- **Ambient float** (`0 10px 30px rgba(var(--shadow-color), 0.10)` — `.shadow-smooth`): Resting elevation for cards that need separation.
- **Card lift** (`0 4px 20px -2px` → `0 8px 30px -4px` on hover — `.shadow-card` / `.shadow-card-hover`): State-response elevation.
- **Primary glow** (`0 0 32px -6px rgba(var(--ring), 0.55)` — `.glow-primary`): Emission for the active, the live, the selected. Also the 1.5px status dot (`0 0 10px var(--primary)`) and the nav active bar (`0 0 12px`).
- **Dock float** (`0 16px 40px -12px rgba(var(--shadow-color), 0.5)`): The bottom nav's deep, diffuse lift — the heaviest shadow in the system, reserved for the one element that floats above everything.

### Named Rules
**The Emission Rule.** Active and live elements glow in the accent; inactive elements never do. Shadows are warm-tinted (`--shadow-color` is brown-black in light mode, pure black in dark), diffuse, and low-opacity — a hard dark shadow reads as 2014 and is prohibited.

**The Earned Glass Rule.** Translucency + blur (`.glass-panel`, the nav dock at 75% opacity / blur-2xl) is reserved for chrome that floats above content: the dock, overlays, capture HUDs. Content cards are opaque surfaces. Glass as default card treatment is forbidden.

## 5. Components

Component feel: **precise and mechanical**. Controls respond like machined switches — crisp state snaps, 150–300ms ease-out transitions, a firm `scale(0.96)` press. No bounce, no elastic overshoot, no decorative motion. (Legacy spring/bounce easings in older code are scheduled for tightening, not emulation.)

### Buttons
- **Shape:** Gently rounded control (8px radius); pill only for floating action chips.
- **Primary:** Solar Flare fill, `var(--primary-fg)` text (deep umber on solar/emerald; white on cobalt/midnight), 44px height (`h-11`), 24px horizontal padding, soft accent-tinted shadow (`shadow-lg shadow-primary/20`).
- **Hover / Focus:** Hover deepens fill toward Solar Flare Deep; focus is a 2px `var(--primary)` ring with 2px offset (`:focus-visible` only — no mouse-click rings).
- **Press:** `scale(0.96)`, ~160ms. Mechanical, immediate.
- **Secondary:** Sunken surface fill + 1px border, ink text. **Outline:** 2px primary border, transparent fill. **Ghost:** muted text, surface tint on hover. **Destructive / Success:** semantic fills, same geometry.
- **Disabled:** 50% opacity, pointer-events off.

### Cards / Containers
- **Corner Style:** 12px standard; 28px for dashboard tiles; 32px for hero panels.
- **Background:** Opaque `var(--bg-surface)` + 1px `var(--border)` hairline.
- **Shadow Strategy:** Flat or ambient-float at rest; lift on hover/press per the Emission Rule.
- **Internal Padding:** 20–24px (`p-5`/`p-6`).

### Inputs / Fields
- **Style:** Sunken surface fill (#F6EEE1 light / #261C10 dark), 1px border, 8px radius, 48px height.
- **Focus:** 2px primary ring, 2px offset.
- **Placeholder:** Umber Muted at full opacity — must hold 4.5:1.
- **Error / Disabled:** Fault Red border + caption; 50% opacity + not-allowed cursor.

### Navigation
- **The floating glass dock** (signature component): fixed bottom, max-w-md, 28px radius, 75%-opacity surface with blur-2xl, hairline top highlight in accent, deep dock-float shadow, 68px tall, safe-area padded.
- **Items:** icon (22px Lucide) + 8px tracked-uppercase label. Inactive: muted at reduced opacity. Active: accent color, soft halo pill behind the icon, glowing 3px underline bar (shared-layout animated between tabs).
- **Premium locks:** 3.5px accent dot with lock glyph on gated tabs.

### Loading & Empty States
- **Skeletons** use the `.shimmer` sweep (surface → sunken → surface, 1.6s linear), never content-area spinners.
- **Empty states** teach the next action ("Scan your first meal") rather than announcing absence.

### The HUD Readout (signature pattern)
Screen headers open with a live status line: pulsing 1.5px glow dot + HUD microlabel in accent + mono data fragments (time, mode). This is the one place the instrument fiction runs at full strength.

## 6. Do's and Don'ts

### Do:
- **Do** style every component against the CSS custom properties (`var(--primary)`, `var(--bg-surface)`, `var(--border)`) so all four accent channels and both modes work for free.
- **Do** use `var(--primary-text)` for accent-colored text/icons on light surfaces and `var(--primary-fg)` for text on primary fills — raw #F07F13 fails 4.5:1 against both white and light surfaces.
- **Do** set every number in JetBrains Mono tabular figures (the Instrument Numeral Rule).
- **Do** keep touch targets ≥44px and primary actions in the thumb zone; pad fixed-bottom elements with `pb-safe`.
- **Do** ship every interactive component with default, hover, focus-visible, active, disabled, and loading states — focus is a 2px primary ring at 2px offset, always.
- **Do** provide `prefers-reduced-motion` alternatives for every animation, including the aurora and shimmer.
- **Do** keep medical-guardrail and safety UI in plain, calm language with full-contrast text — trust beats theater.

### Don't:
- **Don't** recreate MyFitnessPal-style trackers: no ad-dense lists, no ten-deep settings mazes, no cramped logging tables.
- **Don't** drift toward clinical/medical portals: no sterile gray form stacks, no bureaucratic density; warmth is part of the trust model.
- **Don't** gamify like fitness apps: no confetti, badges, mascots, streak-shaming, or motivational gradients.
- **Don't** assemble generic SaaS dashboards: no identical stat-card grids, no purple gradients, no hero-metric templates.
- **Don't** use the legacy `.gradient-text` utility on new work — gradient text is prohibited; emphasis comes from weight, size, or solid Solar Flare.
- **Don't** stack opacity modifiers on Umber/OLED Muted text (`opacity-60`, `/50`): it silently breaks 4.5:1 contrast. Use the token at full opacity or step up to ink.
- **Don't** use colored side-stripe borders (`border-left` > 1px) as accents — full hairline borders or background tints instead.
- **Don't** repeat tracked-uppercase microlabels above every section (the One HUD Rule: once per screen, in the header).
- **Don't** add bounce or elastic easing; if it overshoots, it's off-brand.
- **Don't** hardcode #F07F13 — the Channel Rule depends on `var(--primary)`.
