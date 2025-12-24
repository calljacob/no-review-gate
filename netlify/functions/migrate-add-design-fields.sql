-- Migration: Add design fields to campaigns table
-- Run this in your Neon SQL editor to add logo and color fields

-- Add design fields to campaigns table
ALTER TABLE campaigns 
ADD COLUMN IF NOT EXISTS logo_url TEXT,
ADD COLUMN IF NOT EXISTS primary_color VARCHAR(7),
ADD COLUMN IF NOT EXISTS secondary_color VARCHAR(7),
ADD COLUMN IF NOT EXISTS background_color VARCHAR(7);

