-- Migration: Add role column to users table
-- Run this if the users table already exists without the role column

-- Add role column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'role'
    ) THEN
        ALTER TABLE users ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'user'));
    END IF;
END $$;

-- Update existing users to be admin by default
UPDATE users SET role = 'admin' WHERE role IS NULL OR role = '';

