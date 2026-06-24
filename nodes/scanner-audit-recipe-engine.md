---
title: 'Scanner audit fixes, Supply Engine debug, recipe engine + social import'
type: document
status: published
version: 2
created_at: '2026-06-12T15:37:27.401Z'
tags:
  - '#architecture'
  - '#gotchas'
  - '#product'
updated_at: '2026-06-12T15:37:27.412Z'
checksum: 'sha256:cfd8e793bcbdef2c3ced8a730468b4bc2c1fc4a0368330dd3c6244c18dd3bb59'
---

# Scanner audit fixes, Supply Engine debug, recipe engine + social import

2026-06-12 "critical refactor" build. What changed and why:

- **Menu OCR (vision-menu)**: was a single Gemini call with a hard throw — one 429 killed the scan. Now: env-driven model chain (`VISION_MODELS`) with retry + Qwen-VL backup, a 422 guard when OCR recovers no text (previously empty text flowed into reasoning → hallucinated menus), robust JSON extraction, and output sanitation (calories 0–8000, health_score 1–10, impact whitelist, server-side re-sort by score).
- **Pantry macros — three-layer guarantee**: (1) vision-pipeline pantry mode now asks for per-item `category` + per-100g macros and validates via `validatePantryItems` (band-clamped, midpoint default, `macros_source: vision|clamped|default`); (2) scan page persists them into `metadata_json.macros_per_100g`; (3) DB trigger `pantry_enforce_macros` (migration `20260612030000`) guarantees non-zero macros on EVERY write path — falls back to linked `foods.nutritional_info`, then a 150/5/15/5 default. Backfill update included. The "Neural Supply Engine" consumes these (priority: metadata macros > foods table > floor).
- **Neural Supply Engine = shopping-generator → optimize-meals** (named on shopping/page.tsx:261). Fixed in optimize-meals: **WASM plans now re-validated against medical constraints** (Rust FoodItem carries no sodium/sugar/ingredients — plans violating caps/bans are dropped before reaching users; TS fallback runs if none survive); recent-history fatigue/cooldown reasoning was DEAD (history never fetched) — now built from the last 7 days of logs and fed to both paths; feedback query bounded (`limit 100`, was unbounded); greedy selector now targets remaining-budget ÷ open-slots (was chasing the full remainder per pick → one-item plans).
- **Recipe engine (`recipe-engine` fn + `/recipes` page)**: generates 3 recipes ranked by pantry coverage; `from_pantry` flags are VERIFIED server-side against actual pantry names (not trusted from the model); Smart Swap = deterministic same-category nearest-energy-density pantry substitute for missing ingredients; macros clamped + Atwater backstop; portion scaling is pure client math (`src/lib/utils/recipes.ts: scaleRecipe` — grams scale, per-serving macros invariant). Base servings always 1.
- **Social import (`recipe-import` fn)**: JSON-LD schema.org/Recipe parsed deterministically when present (incl. HowToSection flattening); else og/meta/caption text (+ YouTube/TikTok oEmbed) → LLM structuring; honest 422s for no-text and no-recipe. **SSRF guard** (`assertSafeUrl`) blocks private/loopback/metadata hosts — required, the function fetches user URLs server-side. Video LIMITATION: captions/descriptions only, frames are not analyzed. **Decoupled by design**: `recipes` table is user_id-only (no household_id, no voucher linkage); RLS "Recipes own".
- Deploy: `npx supabase db push` (pantry trigger + recipes), `npx supabase functions deploy vision-pipeline vision-menu optimize-meals recipe-engine recipe-import`. `/recipes` added to AuthGuard PROTECTED_ROUTES + hub Planning group.
- **SSRF hardening (recipe-import, post background-review)**: the first guard only string-matched the literal hostname — bypassable by a domain that *resolves* to a private IP, and by `redirect:"follow"` chasing a 3xx into the metadata endpoint. Now: `resolvePublicIps()` runs `Deno.resolveDns` (A+AAAA) and rejects if ANY resolved address is private/reserved (`ipIsPrivate` covers 0/8, 10/8, 127/8, 100.64/10 CGNAT, 169.254/16 incl. 169.254.169.254 & .170.2 metadata, 172.16/12, 192.0.0/24, 192.168/16, 198.18/15, 224/4+; IPv6 ::1, fe80::/10, fc00::/7 incl. AWS fd00:ec2::254, and IPv4-mapped). `assertSafeUrl` is now async (resolve+check). `safeFetch` replaces blind follow with `redirect:"manual"` + per-hop re-validation, max 4 hops. **Known residual**: TOCTOU DNS-rebinding window between our resolve and the runtime's connect-time resolve — Deno's `fetch` exposes no hook to pin the vetted IP while keeping TLS SNI, so it's validate-then-connect; documented in-code. oEmbed calls hit hardcoded youtube/tiktok hosts only (user URL is a query param), so not a vector.
