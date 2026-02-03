-- Migration: Add agent field to reviews table
-- Run this in your Neon SQL editor to store the Lead Docket agent from query string

ALTER TABLE reviews
ADD COLUMN IF NOT EXISTS agent VARCHAR(255);

-- Optional index if you plan to filter by agent frequently
CREATE INDEX IF NOT EXISTS idx_reviews_agent ON reviews(agent);
