import { getDb } from './utils/db.js';

/**
 * Netlify Serverless Function
 * Handles GET (fetch campaigns) and POST (create campaign) requests
 * 
 * GET: /api/campaigns - Fetch all campaigns
 * POST: /api/campaigns - Create a new campaign
 */
export const handler = async (event, context) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  try {
    const db = getDb();

    // GET - Fetch all campaigns
    if (event.httpMethod === 'GET') {
      const campaigns = await db`
        SELECT id, name, google_link, yelp_link, created_at
        FROM campaigns
        ORDER BY created_at DESC
      `;

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(campaigns),
      };
    }

    // POST - Create a new campaign
    if (event.httpMethod === 'POST') {
      const { name, googleLink, yelpLink } = JSON.parse(event.body);

      if (!name) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Campaign name is required' }),
        };
      }

      const [campaign] = await db`
        INSERT INTO campaigns (name, google_link, yelp_link, created_at)
        VALUES (${name}, ${googleLink || null}, ${yelpLink || null}, NOW())
        RETURNING id, name, google_link, yelp_link, created_at
      `;

      return {
        statusCode: 201,
        headers,
        body: JSON.stringify(campaign),
      };
    }

    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  } catch (error) {
    console.error('Database error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error', message: error.message }),
    };
  }
};

