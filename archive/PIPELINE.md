# Oteka — Full Pipeline Architecture
> Traced from source code, 2026-05-06

---

## Overview

```
┌──────────┐     ┌──────────────┐     ┌─────────────────┐     ┌──────────┐
│  Camera  │────▶│ Supabase     │────▶│ Vision Pipeline │────▶│ Result   │
│  (User)  │     │ Storage      │     │ (Edge Function) │     │ Screen   │
└──────────┘     │ food_scans/  │     └────────┬────────┘     └────┬─────┘
                 └──────────────┘              │                   │
                                    ┌──────────┴──────────┐        │ "Add to
                                    │                     │        │ Daily Log"
                                    ▼                     ▼        ▼
                              ┌──────────┐         ┌──────────┐  ┌──────────┐
                              │ Gemini   │         │ DeepSeek │  │ Supabase │
                              │ (Vision) │────────▶│ (Reason) │  │ logs     │
                              │ Node B   │  desc   │ Node C   │  │ table    │
                              └──────────┘         └──────────┘  └──────────┘
```

---

## Pipeline Stages (Start to Finish)

### Stage 0: User Captures Image
**File:** `src/components/vision/OptimisticCapture.tsx`

1. Camera opens via `navigator.mediaDevices.getUserMedia` (rear-facing, 1080×1920)
2. User taps the capture button → canvas grabs a video frame
3. Frame is resized to max 1024px, converted to JPEG blob
4. Blob is uploaded to **Supabase Storage** bucket `food_scans/{userId}/{timestamp}.jpg`
5. Status transitions: `idle` → `uploading`

### Stage 1: Vision Pipeline Invoked
**File:** `supabase/functions/vision-pipeline/index.ts`

Client calls: `supabase.functions.invoke('vision-pipeline', { body: { imagePath, mode: 'analyze' } })`

Authentication is verified via JWT token (supports both `Authorization: Bearer` and `x-user-token` headers).

### Stage 2: Knowledge Base Injection
Before any AI calls, the pipeline loads 3 knowledge sources from the DB:

| Source | Table | Purpose |
|--------|-------|---------|
| User Profile | `users` | `hand_width_mm` for portion calibration, `metabolic_state_json` |
| Medical Conditions | `user_conditions` → `conditions` | Safety rules, banned ingredients (e.g. "No sugar for Type 2 Diabetes") |
| Metabolic Phenomena | `metabolic_phenomena` | Randle Cycle, mTOR Activation, etc. — injected into DeepSeek prompt |

These are assembled into two context strings:
- **`safetyContext`**: Medical rules + negative ingredient lists
- **`phenomenaContext`**: Metabolic phenomena names + mechanisms

### Stage 3: Node B — Image Identification (Gemini)
**Model cascade:** `gemini-3-flash-preview` → `gemini-2.5-flash` → `Qwen/Qwen2.5-VL-72B-Instruct` (Nebius)

The image (base64) is sent to Gemini with a prompt to:
- List every visible food item
- Describe container/portion relative to hand
- Transcribe any nutrition labels
- Note reference objects for calibration (hand, phone, fork, card)

**Output:** Plain text scene description (e.g. "A plate containing grilled chicken breast (~200g), steamed broccoli (~100g), and white rice (~150g). A fork is visible for scale reference.")

If location context is provided (lat/lng from device GPS), it's injected as a hint to improve restaurant menu matching.

### Stage 4: Calibration Detection
Based on Gemini's description, the pipeline detects reference objects and applies calibration:

| Object Detected | Calibration Applied |
|-----------------|-------------------|
| Hand/palm/fingers | User's `hand_width_mm` from profile |
| Phone/smartphone | ~15cm standard |
| Fork/knife/spoon | ~20cm / ~16cm standard |
| Credit card | ~8.5cm × 5.4cm |
| Bottle/can | 500ml typical |
| None | Standard serving estimates |

### Stage 5: Node C — Nutritional Analysis (DeepSeek V3.2)
**Model:** `deepseek-ai/DeepSeek-V3.2` via Nebius API  
**Fallback:** Gemini (same cascade as Node B)

DeepSeek receives a structured prompt containing:
- Scene description from Node B
- Calibration hint
- Medical safety protocols
- Metabolic knowledge base
- Required JSON output schema

**Output JSON:**
```json
{
  "items": [{ "name": "...", "quantity": "...", "calories": 0, "protein": 0, "carbs": 0, "fat": 0 }],
  "ingredients": [{ "name": "...", "ratio": 0.0 }],
  "macros": { "calories": 0, "protein": 0, "carbs": 0, "fat": 0, "fiber": 0, "sugar": 0, "sodium": 0, "cholesterol": 0 },
  "vitamins": [{ "name": "Vitamin X", "amount": "2.5mg", "daily_value_pct": 0 }],
  "minerals": [{ "name": "Iron", "amount": "3mg", "daily_value_pct": 17 }],
  "micros": [{ "name": "...", "amount": "...", "daily_value_pct": 0 }],
  "volume_cm3": 0,
  "metabolic_insight": {
    "score": -10 to +10,
    "impact_level": "super_bad|bad|neutral|good|super_good",
    "layman_explanation": "...",
    "triggered_phenomena": [{ "id": "randle_cycle", "name": "Randle Cycle", "why": "..." }]
  },
  "safety_alerts": [{ "type": "warning|urgent", "condition_id": "...", "reason": "..." }]
}
```

**JSON Parsing:** The pipeline handles DeepSeek's `<think>` tags by stripping them, then tries markdown code blocks, then raw bracket extraction.

### Stage 6: Result Screen
**File:** `src/components/vision/OptimisticCapture.tsx` (status: `complete`)

The result is rendered in a scrollable view with sticky action buttons:

1. **Header** — "Synced" confirmation with checkmark
2. **Safety Alerts** — Red warnings if medical conditions are triggered
3. **Insight Card** — Food name, calories, metabolic explanation, triggered phenomena badges
4. **Macro Grid** — Protein / Carbs / Fats (3-col)
5. **Extended Macros** — Fiber / Sugar / Sodium / Cholesterol (4-col)
6. **Molecular Scaffolding** — Ingredients with percentage ratios
7. **Vitamins** — Categorized list with amounts + %DV
8. **Minerals** — Categorized list with amounts + %DV
9. **Other Nutrients** — Remaining micros
10. **[STICKY] Add to Daily Log** — Emerald button, always visible
11. **[STICKY] Return to Hub** — Secondary action

### Stage 7: Log Persistence
**Triggered by:** User taps "Add to Daily Log"  
**File:** `src/components/vision/OptimisticCapture.tsx` → `handleLog()`

Inserts into Supabase `logs` table:
```
{
  user_id,
  grams: volume_cm3,
  metabolic_tags_json: {
    item, calories, protein, carbs, fats,
    fiber, sugar, sodium, cholesterol,
    vitamins[], minerals[], micros[],
    ingredients[], reasoning, metabolic_insight,
    image_path
  },
  captured_at
}
```

After insert → invalidates React Query cache (`daily-logs`) → redirects to `/dashboard`.

### Stage 8: Dashboard Aggregation
**File:** `src/lib/hooks/useDashboardData.ts`

Fetches today's logs, sums macros across all entries, renders:
- Calorie ring progress
- P/C/F bars
- Recent meals feed (tap to expand → ingredients, vitamins, minerals)

### Stage 9: AI Coach (On-Demand)
**File:** `supabase/functions/advisor-context/index.ts`  
**Triggered by:** Coach page (`/coach`) on load + user chat messages

1. Loads user profile, medical conditions, metabolic phenomena, recent logs (7 days)
2. Builds system prompt with all context
3. Sends to DeepSeek V3.2 via Nebius
4. **Fallback:** Gemini (`gemini-3-flash-preview` → `gemini-2.5-flash`)
5. Returns personalized metabolic advice

**Body parsing (FIXED):** Now correctly reads `reqBody.query` for chat messages instead of the broken double-nested `body.context`.

---

## Model Usage Summary

| Node | Primary Model | Fallback 1 | Fallback 2 | API |
|------|--------------|------------|------------|-----|
| Vision (see) | gemini-3-flash-preview | gemini-2.5-flash | Qwen2.5-VL-72B | Google AI / Nebius |
| Nutrition (reason) | DeepSeek-V3.2 | gemini-3-flash-preview | gemini-2.5-flash | Nebius / Google AI |
| Advisor (coach) | DeepSeek-V3.2 | gemini-3-flash-preview | gemini-2.5-flash | Nebius / Google AI |

**Token cost per scan:** ~1 Gemini call (vision, free tier) + ~1 DeepSeek call (Nebius, ~$0.001-0.003/scan)  
**Token cost per coach message:** ~1 DeepSeek call (~$0.001/msg)

---

## Database Schema (Key Tables)

| Table | Purpose |
|-------|---------|
| `users` | Profile, hand calibration, metabolic state, streak |
| `user_conditions` | FK to conditions (e.g. Type 2 Diabetes) |
| `conditions` | Medical rules, banned ingredients, safety protocols |
| `metabolic_phenomena` | Randle Cycle, mTOR, etc. with explanation templates |
| `logs` | Food entries with full JSON blob (macros, vitamins, minerals, ingredients, metabolic insight) |
| `pantry_items` | Tracked pantry inventory from pantry scans |
| `cache_entries` | General-purpose key-value cache |

**Indexes:** `logs(user_id, captured_at DESC)`, `logs(user_id)`

---

## Theme System

CSS variables defined in `globals.css`, switched via class on `<html>`:
- **5 themes:** Default, Solar, Emerald, Cobalt, Midnight
- **2 modes:** Light (default) / Dark (`.dark` class)
- All UI components use `var(--bg-surface)`, `var(--text-primary)`, etc.
- `tailwind.config.ts` has `darkMode: 'class'` for `dark:` utility support

---

## File Map (Modified in this session)

```
src/
├── app/
│   ├── layout.tsx              ← Removed hardcoded text-white
│   ├── globals.css             ← Complete dark mode variables + solar theme
│   ├── dashboard/page.tsx      ← CSS-variable-aware quick actions
│   ├── log/page.tsx            ← LogEntryCard with vitamins/minerals/ingredients
│   ├── history/page.tsx        ← LogItem with categorized nutrients
│   ├── profile/page.tsx        ← Fixed opacity bug on separators
│   └── vision/page.tsx         ← Fixed missing CSS class
├── components/
│   ├── providers/
│   │   └── ClientProviders.tsx  ← Removed double BottomNav
│   ├── ui/
│   │   └── SafetyAlert.tsx      ← Theme-aware colors
│   └── vision/
│       └── OptimisticCapture.tsx ← Sticky log button + full nutrient display
├── lib/
│   ├── db/schema.sql            ← Indexes + column rename
│   ├── engine/metabolic/
│   │   └── phenomena.json       ← Renamed field to explanation_template
│   └── llm/providers.ts         ← Updated model references
supabase/functions/
├── vision-pipeline/index.ts     ← Expanded prompt (vitamins/minerals/extended macros)
└── advisor-context/index.ts     ← Fixed body parsing + Gemini fallback
```
