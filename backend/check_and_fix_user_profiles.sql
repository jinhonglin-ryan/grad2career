-- Check and Fix user_profiles Table Schema
-- Run this in your Supabase SQL Editor to ensure the table has the correct columns

-- 1. Check if user_profiles table exists and what columns it has
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'user_profiles'
ORDER BY ordinal_position;

-- 2. If the table doesn't have all required columns, add them
-- This ensures backward compatibility

-- Add skills column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_profiles' AND column_name = 'skills'
    ) THEN
        ALTER TABLE user_profiles ADD COLUMN skills JSONB DEFAULT '[]'::jsonb;
        RAISE NOTICE 'Added skills column';
    END IF;
END $$;

-- Add tools column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_profiles' AND column_name = 'tools'
    ) THEN
        ALTER TABLE user_profiles ADD COLUMN tools JSONB DEFAULT '[]'::jsonb;
        RAISE NOTICE 'Added tools column';
    END IF;
END $$;

-- Add certifications column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_profiles' AND column_name = 'certifications'
    ) THEN
        ALTER TABLE user_profiles ADD COLUMN certifications JSONB DEFAULT '[]'::jsonb;
        RAISE NOTICE 'Added certifications column';
    END IF;
END $$;

-- Add work_experience column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_profiles' AND column_name = 'work_experience'
    ) THEN
        ALTER TABLE user_profiles ADD COLUMN work_experience TEXT;
        RAISE NOTICE 'Added work_experience column';
    END IF;
END $$;

-- Add career_goals column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_profiles' AND column_name = 'career_goals'
    ) THEN
        ALTER TABLE user_profiles ADD COLUMN career_goals TEXT;
        RAISE NOTICE 'Added career_goals column';
    END IF;
END $$;

-- 3. Verify the table structure again
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'user_profiles'
ORDER BY ordinal_position;

-- 4. If you need to recreate the table from scratch, uncomment and run this:
/*
DROP TABLE IF EXISTS user_profiles CASCADE;

CREATE TABLE user_profiles (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    skills JSONB DEFAULT '[]'::jsonb,
    tools JSONB DEFAULT '[]'::jsonb,
    certifications JSONB DEFAULT '[]'::jsonb,
    work_experience TEXT,
    career_goals TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create trigger for auto-updating updated_at
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
*/

-- 5. Check if there are any existing user_profiles records
SELECT COUNT(*) as total_profiles FROM user_profiles;

-- 6. Sample data to verify structure
SELECT * FROM user_profiles LIMIT 5;

