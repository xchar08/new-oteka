-- Set medical_verified for existing users so they aren't stuck in onboarding loop
UPDATE users 
SET metabolic_state_json = metabolic_state_json || '{"medical_verified": true}'::jsonb
WHERE metabolic_state_json IS NOT NULL 
AND (metabolic_state_json->>'medical_verified') IS NULL;
