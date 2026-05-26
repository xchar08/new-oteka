# Social UI Revamp Implementation Plan

> **For Gemini:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Overhaul the Social and Household pages to match the "Solar Vitality" theme seen on the Dashboard.

**Architecture:** Use `framer-motion` for staggered animations, CSS variables for theme-consistent colors, and aggressive rounded corners (32px-40px). Logic will remain in the client components, interacting with Supabase.

**Tech Stack:** React, Next.js, TailwindCSS, Lucide-React, Framer Motion, Supabase.

---

### Task 1: Revamp Social Page UI

**Files:**
- Modify: `src/app/social/page.tsx`

**Step 1: Update Framer Motion variants and Header**
Update the top of the component to include `container` and `item` variants. Update the header to use a gradient background and `rounded-b-[40px]`.

**Step 2: Update Tabs and Inbox**
Redesign the tab switcher and pending requests inbox to use glassmorphic styles and consistent rounding.

**Step 3: Update Leaderboard List**
Update the leaderboard items to use `rounded-[32px]` glass cards with subtle glow borders and staggered animations.

**Step 4: Update Search Modal**
Redesign the search modal to match the dashboard's "Solar" look.

**Step 5: Verify Logic**
Ensure friend requests, searching, and tab switching still work.

### Task 2: Revamp Household Page UI

**Files:**
- Modify: `src/app/social/household/page.tsx`

**Step 1: Update Header and Layout**
Update the header to match the new social page style.

**Step 2: Update Household Status Card**
Redesign the main household card to be `rounded-[32px]` with a "technical" display for the join code.

**Step 3: Update Member List**
Update member items to match the leaderboard style from Task 1.

**Step 4: Update Sync Protocol Section**
Redesign the "Merge" section with a cleaner input and button style.

**Step 5: Verify Logic**
Ensure joining, leaving, and copying the code still work.

### Task 3: Global Streak Consistency

**Files:**
- Modify: `src/app/profile/page.tsx`
- Modify: `src/app/profile/member/page.tsx`

**Step 1: Update Streak Components**
Ensure all streak displays use the same Flame icon and "Solar" glow pattern.
