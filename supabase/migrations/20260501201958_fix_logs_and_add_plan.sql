-- Fix logs default and add plan to users
ALTER TABLE logs ALTER COLUMN metabolic_tags_json SET DEFAULT '{}'::jsonb;

-- Add plan column to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS plan text DEFAULT 'free';

-- Update Jeremiah to pro (if exists)
UPDATE users SET plan = 'pro' WHERE display_name ILIKE '%jeremiah%';
