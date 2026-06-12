---
title: On-primary and accent-text contrast tokens
type: document
status: published
version: 2
created_at: '2026-06-11T05:36:04.428Z'
tags:
  - '#design-system'
  - '#conventions'
  - '#a11y'
updated_at: '2026-06-11T05:36:04.437Z'
checksum: 'sha256:065c83a6e7c89a23e4bd8bda03eaf96f8f6b9ee74301d71868ba3ee79e72ce46'
---

# On-primary and accent-text contrast tokens

Added during the 2026-06-11 dashboard polish, in `src/app/globals.css`. Three rules every new surface must follow:

1. **Text on a primary fill uses `var(--primary-fg)`, never `text-white`.** White on Solar Flare #F07F13 is only ~2.7:1. `--primary-fg` is per-channel: deep umber `#221A12` on solar (6.3:1) and `#03110C` on emerald (6.1:1); white on cobalt/midnight (where it passes). `.dark` does NOT override it — primary hues are identical in dark mode.
2. **Accent-colored text/icons on light surfaces use `var(--primary-text)`.** Raw `text-[var(--primary)]` is ~2.7:1 on white/paper. `--primary-text` is a deepened brand hue per channel (#8A4708 solar, #0B6A47 emerald, #1F56E0 cobalt, #7A48EB midnight); in `.dark` it resolves to `var(--primary)` because the bright accent passes on OLED black. Same pattern: `--success-text` (#0B6A47 light, `var(--success)` dark) and `--error-text` (#AA3B2F light ≈5.8:1, `var(--error)` dark) — raw `--error` #D14D41 is only ~4.0:1 on light surfaces, so small error text must use `--error-text`.
3. **Never stack opacity modifiers on `--text-secondary`** (`opacity-40`, `/50`) — full-opacity secondary is 5.6:1 on the light bg; any stacking breaks AA.

Also from that pass: the dashboard "Metabolic Score" was a hardcoded `88 + streak_count` — replaced with an honest calorie gauge (`Daily Energy`); don't reintroduce fabricated metrics. Caveat: white on the midnight primary #8B5CF6 is ~4.2:1 — passes large/bold text only; avoid small white text on midnight primary fills.
