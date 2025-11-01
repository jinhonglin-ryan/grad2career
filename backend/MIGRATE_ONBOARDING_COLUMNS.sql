-- Migration script to add onboarding columns to users table
-- Run this in Supabase SQL Editor if you see errors about missing columns

-- Add onboarding_completed column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'onboarding_completed'
  ) THEN
    ALTER TABLE users ADD COLUMN onboarding_completed BOOLEAN DEFAULT FALSE;
    RAISE NOTICE 'Added onboarding_completed column';
  ELSE
    RAISE NOTICE 'Column onboarding_completed already exists';
  END IF;

  -- Add onboarding_completed_at column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'onboarding_completed_at'
  ) THEN
    ALTER TABLE users ADD COLUMN onboarding_completed_at TIMESTAMP WITH TIME ZONE;
    RAISE NOTICE 'Added onboarding_completed_at column';
  ELSE
    RAISE NOTICE 'Column onboarding_completed_at already exists';
  END IF;
END $$;

-- Verify the columns were added
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'users' 
  AND column_name IN ('onboarding_completed', 'onboarding_completed_at')
ORDER BY column_name;

