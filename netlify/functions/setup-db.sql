-- Database setup script for Neon/PostgreSQL
-- Run this in your Neon SQL editor to set up the initial schema

-- Create campaigns table
CREATE TABLE IF NOT EXISTS campaigns (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  google_link TEXT,
  yelp_link TEXT,
  logo_url TEXT,
  primary_color VARCHAR(7),
  secondary_color VARCHAR(7),
  background_color VARCHAR(7),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create users table for authentication
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create reviews table
CREATE TABLE IF NOT EXISTS reviews (
  id SERIAL PRIMARY KEY,
  lead_id VARCHAR(255) NOT NULL,
  agent VARCHAR(255),
  campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  feedback TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create link click tracking table
CREATE TABLE IF NOT EXISTS link_clicks (
  id SERIAL PRIMARY KEY,
  campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  lead_id VARCHAR(255),
  project_id VARCHAR(255),
  agent VARCHAR(255),
  button_type VARCHAR(20) NOT NULL CHECK (button_type IN ('google', 'yelp')),
  target_url TEXT NOT NULL,
  user_agent TEXT,
  ip_address VARCHAR(64),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_reviews_campaign_id ON reviews(campaign_id);
CREATE INDEX IF NOT EXISTS idx_reviews_lead_id ON reviews(lead_id);
CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON reviews(created_at);
CREATE INDEX IF NOT EXISTS idx_link_clicks_campaign_id ON link_clicks(campaign_id);
CREATE INDEX IF NOT EXISTS idx_link_clicks_button_type ON link_clicks(button_type);
CREATE INDEX IF NOT EXISTS idx_link_clicks_created_at ON link_clicks(created_at);

-- Optional: Create a view for campaign statistics
CREATE OR REPLACE VIEW campaign_stats AS
SELECT 
  c.id,
  c.name,
  COUNT(r.id) as total_reviews,
  AVG(r.rating) as average_rating,
  COUNT(CASE WHEN r.rating >= 4 THEN 1 END) as positive_reviews,
  COUNT(CASE WHEN r.rating < 4 THEN 1 END) as negative_reviews
FROM campaigns c
LEFT JOIN reviews r ON c.id = r.campaign_id
GROUP BY c.id, c.name;
