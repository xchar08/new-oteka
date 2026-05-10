# Code Review Fixes Plan

## Objective
Apply all fixes discovered during the code review, addressing both functional and security issues.

## Key Files & Changes

1. **`src/app/travel/menu/page.tsx`**
   - **Issue:** Non-idiomatic `(require('react')).useEffect`.
   - **Change:** Replace with a proper `useEffect` call using the existing React import.

2. **`src/lib/supabase/client.ts`**
   - **Issue:** Fallback dummy client masks missing environment variable errors.
   - **Change:** Throw an explicit error instead of returning a placeholder client.

3. **`src/lib/utils/metabolic.utils.ts`**
   - **Issue:** Mismatch in unit assignment during nutrient aggregation.
   - **Change:** Hardcode the unit to `"mg"` during aggregation to ensure consistency with the normalized amount.

4. **`src/app/dashboard/page.tsx`**
   - **Issue:** `mounted` check wrapped around the loading state causes a hydration flicker.
   - **Change:** Only check for `loading` before returning the spinner, allowing cached data to render without the flicker.

5. **`supabase/functions/create-checkout-session/index.ts`**
   - **Issue:** Potential IDOR/price manipulation by trusting the `priceId` sent from the client.
   - **Change:** Validate `priceId` against an allowed list of known Stripe price IDs (e.g., `"price_1OTeKaSolarMonth"`) before creating the checkout session.

## Verification
- Ensure all files compile without TS errors.
- Confirm the `priceId` validation prevents arbitrary inputs in the edge function.
- Verify `src/app/dashboard/page.tsx` does not flicker unnecessarily.