-- Migration script to add onboarding columns to existing users table
-- Run this in Supabase SQL Editor if the columns don't exist yet

-- Add onboarding columns if they don't exist
DO $$ 
BEGIN
  -- Add onboarding_completed column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'onboarding_completed'
  ) THEN
    ALTER TABLE users ADD COLUMN onboarding_completed BOOLEAN DEFAULT FALSE;
  END IF;

  -- Add onboarding_completed_at column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'onboarding_completed_at'
  ) THEN
    ALTER TABLE users ADD COLUMN onboarding_completed_at TIMESTAMP WITH TIME ZONE;
  END IF;
END $$;

-- Update existing users who have metadata with onboarding data to mark as completed
UPDATE users
SET onboarding_completed = TRUE
WHERE metadata IS NOT NULL 
  AND metadata::text != '{}'::text
  AND (metadata->>'onboarding_completed_at') IS NOT NULL;

