-- Migration: Add link click tracking table
-- Run this in your Neon SQL editor to add tracking for Google/Yelp button clicks

CREATE TABLE IF NOT EXISTS link_clicks (
  id SERIAL PRIMARY KEY,
  campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  review_id INTEGER REFERENCES reviews(id) ON DELETE SET NULL,
  lead_id VARCHAR(255),
  project_id VARCHAR(255),
  agent VARCHAR(255),
  button_type VARCHAR(20) NOT NULL CHECK (button_type IN ('google', 'yelp')),
  target_url TEXT NOT NULL,
  user_agent TEXT,
  ip_address VARCHAR(64),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE link_clicks
ADD COLUMN IF NOT EXISTS review_id INTEGER REFERENCES reviews(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_link_clicks_campaign_id ON link_clicks(campaign_id);
CREATE INDEX IF NOT EXISTS idx_link_clicks_review_id ON link_clicks(review_id);
CREATE INDEX IF NOT EXISTS idx_link_clicks_button_type ON link_clicks(button_type);
CREATE INDEX IF NOT EXISTS idx_link_clicks_created_at ON link_clicks(created_at);
