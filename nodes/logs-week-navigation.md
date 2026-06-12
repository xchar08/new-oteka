---
title: 'Logs week navigation: free-tier cap, useWeekLogs, ?date= deep links'
type: document
status: published
version: 2
created_at: '2026-06-11T16:05:50.786Z'
tags:
  - '#architecture'
  - '#conventions'
  - '#product'
updated_at: '2026-06-11T16:05:50.793Z'
checksum: 'sha256:1ae0de1d13ca26d77f1b24dea7816e7a604b800d6f805a468b59adc2ffb6eb7b'
---

# Logs week navigation: free-tier cap, useWeekLogs, ?date= deep links

Shaped and built 2026-06-11 (brief confirmed by the owner). Key decisions:

- **Pre-existing bug this fixed:** the dashboard Logs tab filtered `dailyLogs` (today-only fetch via `visionService.getDailyLogs`) by any selected day — every non-today day always showed empty. Day data now comes from `useWeekLogs(weekStart)` (`src/lib/hooks/useWeekLogs.ts`): Monday-anchored `local_date` range query, one react-query cache entry per week, current week merges the offline optimistic-capture queue. The hub gauge/calibration banner still use `useMetabolicLogs` (today-only) — don't unify them casually; their jobs differ.
- **Free-tier boundary is a product decision:** free users browse the current week + one back. Paging further intercepts *before any fetch* and opens `ProUpgradeDialog` (quiet-premium: explicit-action-only, plain value copy, one CTA → /pricing). The gated back-chevron shows the standard lock dot. Pro (`isPaidPlan`) is unlimited. Deep links beyond the boundary clamp back to today for free users (effect on user load).
- **Deep links:** `?date=YYYY-MM-DD` joins the established `?tab=` convention (URL wins, sessionStorage fallback; param removed when the selection is today). Same-weekday selection is kept when paging weeks, clamped to today in the current week.
- **Shared dialog a11y:** focus trap/Esc/restore extracted to `useModalA11y` (`src/lib/hooks/useModalA11y.ts`); NutrientInfoModal and ProUpgradeDialog both use it — new dialogs should too.
- **History page** stays as the flat recent-50 feed; Logs links to it ("View full history →" under the feed, and in past-day empty states where the Scan CTA is hidden — you can't scan yesterday's meal).
