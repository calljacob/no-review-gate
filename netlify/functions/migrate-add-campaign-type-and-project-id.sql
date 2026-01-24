-- Migration: Add campaign_type to campaigns table and project_id to reviews table
-- Run this in your Neon SQL editor to add support for Lead Docket and Filevine campaigns

-- Add campaign_type field to campaigns table
-- 'lead_docket' for Lead Docket campaigns (uses lead_id)
-- 'filevine' for Filevine campaigns (uses project_id)
ALTER TABLE campaigns 
ADD COLUMN IF NOT EXISTS campaign_type VARCHAR(20) NOT NULL DEFAULT 'lead_docket' 
CHECK (campaign_type IN ('lead_docket', 'filevine'));

-- Make lead_id nullable in reviews table (Filevine campaigns won't use it)
ALTER TABLE reviews 
ALTER COLUMN lead_id DROP NOT NULL;

-- Add project_id field to reviews table (for Filevine campaigns)
ALTER TABLE reviews 
ADD COLUMN IF NOT EXISTS project_id VARCHAR(255);

-- Create index for better query performance when filtering by project_id
CREATE INDEX IF NOT EXISTS idx_reviews_project_id ON reviews(project_id);

-- Create index for better query performance when filtering by campaign_type
CREATE INDEX IF NOT EXISTS idx_campaigns_campaign_type ON campaigns(campaign_type);

-- Add constraint: either lead_id or project_id must be set (but not both)
-- Note: This is a check constraint that ensures at least one is set
-- We'll handle this in application logic since PostgreSQL doesn't support XOR constraints easily
