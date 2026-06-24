---
title: Workflows = on-device local-notification agents
type: document
status: published
version: 2
created_at: '2026-06-23T03:27:44.185Z'
tags:
  - '#architecture'
  - '#gotchas'
  - '#workflows'
updated_at: '2026-06-23T03:27:44.196Z'
checksum: 'sha256:0bb85f4d3ac5b4dd2e34cd62a13f7b9cf33939dc207885f1a1e2cfac6f3f1a04'
---

# Workflows = on-device local-notification agents

**Gotcha (historical):** The original `src/app/workflows/page.tsx` queried a
`workflows` table using columns that never existed — `name`, `trigger_type`,
`definition_json`, `is_active`, `last_run_at`, numeric `id`. The real table
(`src/lib/db/schema.sql:191`) only has `id uuid`, `user_id`, `trigger_event`,
`last_run_status`, `logs_json`, `created_at`, `updated_at`. So every row
rendered with `undefined` fields and `toggleActive` silently wrote to a
non-existent column. There is **no** server-side workflow runner (no pg_cron,
no scheduler edge function).

**Decision:** Rebuilt Workflows as **on-device scheduled reminder "agents"**
backed by `@capacitor/local-notifications` (already a dependency; the
permission + deep-link pattern lives in
`src/components/providers/NotificationHandler.tsx`). Agents persist to
**localStorage** (`oteka_agents`), NOT the DB — the `workflows` table is left
unused by the UI.

**Why:** No backend executor exists, so any DB-backed CRUD would be a fake
feature. Local notifications give a genuinely working feature with zero new
server infrastructure, and they work offline.

**How it works:** 4 presets (meal log, hydration, pantry review, calibration)
→ daily recurring `LocalNotifications.schedule({ schedule: { on: { hour,
minute } } })`. `notificationId` is a random 32-bit int (Android requires
int). On web (`!Capacitor.isNativePlatform()`) agents are saved but not
scheduled — a banner says delivery happens in the mobile app. Notifications
carry `extra.route` for deep-linking, consumed by `NotificationHandler`.
Reachable from the hub (`src/app/hub/page.tsx:74`).
