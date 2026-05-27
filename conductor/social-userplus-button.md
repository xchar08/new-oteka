# Social UserPlus Button Update Plan

**Goal:** Update the UserPlus (Find Friends) button on the Rankings page to match the Mission Control aesthetic while ensuring theme swapping still works.

**Status:** Completed.

1.  **Social Page (`src/app/social/page.tsx`)**: 
    - Transformed the solid background button to a glassmorphic instrument (`backdrop-blur-md bg-[var(--primary)]/10`).
    - Added a subtle border (`border-[var(--primary)]/30`) for the "solar glow".
    - Added `animate-pulse` to the `UserPlus` icon for a kinetic effect.
    - Updated hover states to use CSS variables and opacity changes instead of solid colors.
    - Preserved all `var(--primary)` CSS variables to ensure theme swapping works correctly.
