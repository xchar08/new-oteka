# Project Architecture & Codebase Map

- ## 1. Route Map
    ```text
    / (Root)
    ├── about
    ├── analytics
    ├── coach
    ├── dashboard
    ├── history
    ├── hub
    ├── log
    ├── login
    ├── onboarding
    │   ├── calibration
    │   ├── medical
    │   ├── profile
    │   └── taste
    ├── pantry
    │   └── scan
    ├── pricing
    ├── privacy
    ├── profile
    │   └── member
    ├── rating
    ├── settings
    │   └── medical
    ├── shopping
    ├── social
    │   └── household
    ├── terms
    ├── travel
    │   └── menu
    ├── vision
    └── workflows
    ```
    The application provides a comprehensive platform for meal planning, pantry management, and health tracking, featuring specialized workflows for onboarding, travel menus, and social household sharing. Users can log meals, analyze nutrition, and use computer vision for pantry scanning and menu analysis to optimize their dietary habits.

- ## 2. Database Schema
    | Table | Description | Key Relationships |
    | :--- | :--- | :--- |
    | **households** | Shared groups for multi-user coordination. | - |
    | **users** | Core user profiles, metabolic state, and settings. | `household_id` -> households.id |
    | **foods** | Master reference for food items and nutritional coefficients. | - |
    | **pantry** | Inventory of food items for users/households. | `user_id` -> users.id, `household_id` -> households.id, `food_id` -> foods.id |
    | **logs** | Daily meal and metabolic activity tracking. | `user_id` -> users.id, `workflow_id` -> workflows.id |
    | **shopping_list** | Shared grocery and item lists for a household. | `household_id` -> households.id, `added_by` -> users.id |
    | **friendships** | Peer-to-peer relationships between users. | `user_id`, `friend_id` -> users.id |
    | **conditions** | Health and dietary restriction master list (e.g., keto, diabetes). | - |
    | **user_conditions** | Mapping of users to their specific dietary conditions. | `user_id` -> users.id, `condition_id` -> conditions.id |
    | **food_taste_profiles** | AI-derived taste vectors (FART dataset) for food items. | `food_id` -> foods.id |
    | **workflows** | State tracking for complex multi-step user processes. | `user_id` -> users.id |
    | **subscriptions** | Stripe subscription status and billing tracking. | `user_id` -> users.id |
    | **metabolic_phenomena** | Reference templates for metabolic events. | - |
    | **cache_entries** | Temporary storage for expensive computations or API results. | - |
    | **vouchers** | Management of access codes and discounts. | `redeemed_by` -> users.id |

- ## 3. Core Logic & Math
    ### 1. Multi-Objective Genetic Optimizer (NSGA-II / Local GA)
    Located in `src/lib/engine/planner/`, this engine selects optimal meal combinations from the pantry or global database.
    - **Chromosomes**: A set of selected food items representing a meal plan.
    - **Fitness Function**: Calculates a weighted score based on multiple penalties and bonuses:
        - **Nutritional Deviation**: Absolute difference from target calories ($k=1.0$) and protein ($k=2.0$).
        - **Pantry Integrity**: Penalty (50-1000 pts) for each item not currently in stock.
        - **Decision Fatigue**: Decay penalty ($500 / (days\_ago + 1)$) for recently eaten items.
        - **Freshness/Waste Bonus**: Rewards (up to 50 pts) for items near their expiry date or with high probability of decay.
    - **Evolution**: Iterates through generations (default: 20) using elitism selection and mutation to minimize the fitness score.

    ### 2. Taste Affinity & Diversity Engine (FART-Inspired)
    Located in `src/lib/engine/taste/taste-engine.ts`, this uses chemical language model principles to predict and match flavor profiles.
    - **Cosine Similarity**: Calculates affinity between User Profile ($U$) and Food Vector ($F$) across 4 dimensions (Sweet, Bitter, Sour, Umami):
      $$\text{Affinity} = \frac{\sum (U_i \times F_i)}{\sqrt{\sum U_i^2} \times \sqrt{\sum F_i^2}}$$
    - **Shannon Entropy**: Measures taste diversity to avoid flavor monotony:
      $$H = -\sum (p_i \log_2 p_i) \text{ where } p_i \text{ is the normalized intensity of taste } i.$$
    - **EMA Feedback**: Updates user profiles using an Exponential Moving Average:
      $$\text{Profile}_{new} = \text{Profile}_{old} + (\text{Direction} \times \text{LearningRate} \times \text{FoodTaste})$$

    ### 3. Pantry Entropy (Stochastic Probability Decay)
    Implemented as a database-side atomic function in `supabase/migrations/` and `src/lib/db/schema.sql`.
    - **Decay Formula**: Simulates the likelihood of an item still being in the pantry without manual verification:
      $$P_{new} = P_{old} \times (1 - R \times (2.0 - f))^{d}$$
      - $R$: Category-specific decay rate (e.g., Produce decays faster than Grains).
      - $f$: Remaining fraction of the item (0.0 to 1.0).
      - $d$: Days elapsed since last verification.
    - **State Transition**: When $P_{new} < 0.3$, the item status is automatically flagged as `review_needed`.

- ## 4. Orphaned Files & Cleanup
    The following files and components appear to be orphaned (not imported or used by any active application route):

    ### Orphaned Components
    - `src/components/dashboard/TravelHud.tsx`: Location-aware logistics HUD; currently unused in main dashboard.
    - `src/components/vision/BarcodeScanner.tsx`: Implementation for traditional barcode scanning; replaced by or not yet integrated into `OptimisticCapture`.
    - `src/components/viz/NutrientRadar.tsx`: Specialized radar chart for macro/micro nutrients; currently unused in analytics/logs.

    ### Orphaned Library Files & Hooks
    - `src/proxy.ts`: Root proxy utility; no active references in application logic.
    - `src/lib/redis.ts`: Upstash Redis client; caching currently handled via browser storage or Supabase.
    - `src/lib/audit/logger.ts`: Client-side audit logger; diagnostic logging integrated into individual services.
    - `src/lib/engine/medical/rules.ts`: Raw medical rule logic; logic moved to `src/lib/engine/planner/worker.ts` or handled via JSON config.
    - `src/lib/engine/pantry/entropy.ts`: TypeScript implementation of entropy decay; replaced by SQL-side `run_entropy_cycle` function.
    - `src/lib/llm/providers.ts`: LLM configuration; providers currently defined inline or via environment variables in specific services.
    - `src/lib/places/searchNearby.ts`: Google Places API wrapper; search logic currently implemented directly within `src/lib/hooks/useGeolocation.ts`.
    - `src/lib/vision/webgpu-guard.ts`: WebGPU safety check; modern vision pipeline currently uses standard browser-based inference or falls back to server-side.
