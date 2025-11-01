-- Script to check and update onboarding_completed in metadata for existing users
-- Run this in Supabase SQL Editor to fix existing records

-- First, check which users have onboarding data but missing onboarding_completed in metadata
SELECT 
    id,
    email,
    onboarding_completed,
    metadata->>'onboarding_completed' as metadata_onboarding_completed,
    metadata->>'onboarding_completed_at' as metadata_onboarding_completed_at
FROM users
WHERE metadata IS NOT NULL 
  AND metadata::text != '{}'::text
  AND metadata->>'onboarding_completed_at' IS NOT NULL;

-- Update users who have onboarding_completed_at in metadata but missing onboarding_completed flag
UPDATE users
SET metadata = jsonb_set(
    metadata::jsonb,
    '{onboarding_completed}',
    'true'::jsonb,
    true  -- create if missing
)
WHERE metadata IS NOT NULL 
  AND metadata::text != '{}'::text
  AND metadata->>'onboarding_completed_at' IS NOT NULL
  AND (metadata->>'onboarding_completed' IS NULL OR metadata->>'onboarding_completed' = 'false');

-- Verify the update
SELECT 
    id,
    email,
    onboarding_completed,
    metadata->>'onboarding_completed' as metadata_onboarding_completed,
    metadata->>'onboarding_completed_at' as metadata_onboarding_completed_at
FROM users
WHERE metadata IS NOT NULL 
  AND metadata->>'onboarding_completed_at' IS NOT NULL;

