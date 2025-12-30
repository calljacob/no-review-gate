-- Migration: Add enabled field to campaigns table
-- Run this in your Neon SQL editor to add the enabled field

-- Add enabled field to campaigns table (defaults to true for existing campaigns)
ALTER TABLE campaigns 
ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT true;

-- Create index for better query performance when filtering by enabled status
CREATE INDEX IF NOT EXISTS idx_campaigns_enabled ON campaigns(enabled);


