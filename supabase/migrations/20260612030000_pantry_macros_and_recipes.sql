-- ============================================================================
-- PANTRY MACRO ENFORCEMENT + RECIPES
--   1. Strict default validation: every pantry row carries non-zero
--      macros_per_100g in metadata_json, enforced by trigger at the source
--      (covers vision scans, manual adds, and any future write path).
--   2. recipes table for the dynamic recipe engine + social import parser.
--      Deliberately decoupled: no household linkage, no voucher linkage.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. PANTRY: macros_per_100g guaranteed non-zero on every row
-- ----------------------------------------------------------------------------
create or replace function public.pantry_enforce_macros()
returns trigger
language plpgsql
as $$
declare
  v_meta jsonb;
  v_cal numeric;
  v_food jsonb;
begin
  v_meta := coalesce(new.metadata_json, '{}'::jsonb);
  v_cal := nullif(v_meta #>> '{macros_per_100g,calories}', '')::numeric;

  if v_cal is null or v_cal <= 0 then
    -- Prefer the linked foods-table profile when one exists
    if new.food_id is not null then
      select nutritional_info into v_food from public.foods where id = new.food_id;
    end if;

    if v_food is not null and coalesce(nullif(v_food->>'calories', '')::numeric, 0) > 0 then
      v_meta := jsonb_set(v_meta, '{macros_per_100g}', jsonb_build_object(
        'calories', coalesce(nullif(v_food->>'calories', '')::numeric, 150),
        'protein',  coalesce(nullif(v_food->>'protein', '')::numeric, 5),
        'carbs',    coalesce(nullif(v_food->>'carbs', '')::numeric, 15),
        'fat',      coalesce(nullif(v_food->>'fats', '')::numeric, nullif(v_food->>'fat', '')::numeric, 5)
      ));
      v_meta := jsonb_set(v_meta, '{macros_source}', '"foods_table"');
    else
      -- Validated non-zero default: a generic packaged-food profile.
      -- Flagged so the UI/engine can show "estimated" and refine later.
      v_meta := jsonb_set(v_meta, '{macros_per_100g}',
        '{"calories":150,"protein":5,"carbs":15,"fat":5}'::jsonb);
      v_meta := jsonb_set(v_meta, '{macros_source}', '"default"');
    end if;
  end if;

  new.metadata_json := v_meta;
  return new;
end;
$$;

drop trigger if exists pantry_enforce_macros_trg on pantry;
create trigger pantry_enforce_macros_trg
  before insert or update on pantry
  for each row execute function public.pantry_enforce_macros();

-- Backfill existing rows (trigger fires on the no-op update)
update pantry set metadata_json = coalesce(metadata_json, '{}'::jsonb)
 where nullif(metadata_json #>> '{macros_per_100g,calories}', '') is null
    or (metadata_json #>> '{macros_per_100g,calories}')::numeric <= 0;

-- ----------------------------------------------------------------------------
-- 2. RECIPES (engine output + social imports). No household/voucher coupling.
-- ----------------------------------------------------------------------------
create table if not exists recipes (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references users(id) on delete cascade,
  title text not null,
  source_url text,
  source_type text not null default 'generated' check (source_type in ('generated', 'imported')),
  servings int not null default 1,
  ingredients jsonb not null default '[]'::jsonb,   -- [{name, grams|quantity, from_pantry, swap?}]
  instructions jsonb not null default '[]'::jsonb,  -- [string]
  macros_per_serving jsonb default '{}'::jsonb,
  pantry_coverage numeric,                          -- 0..1 at generation time
  created_at timestamptz default now()
);

create index if not exists idx_recipes_user_created on recipes(user_id, created_at desc);

alter table recipes enable row level security;

drop policy if exists "Recipes own" on recipes;
create policy "Recipes own" on recipes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
