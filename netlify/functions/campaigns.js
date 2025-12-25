import { getDb } from './utils/db.js';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

/**
 * Helper function to verify admin authentication
 */
async function verifyAdmin(event) {
  const cookies = event.headers.cookie || '';
  const cookieToken = cookies.split(';').find(c => c.trim().startsWith('token='));
  const token = cookieToken 
    ? cookieToken.split('=')[1] 
    : event.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return { authenticated: false, error: 'Authentication required' };
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    if (decoded.role !== 'admin') {
      return { authenticated: false, error: 'Admin access required' };
    }

    return { authenticated: true, userId: decoded.userId };
  } catch (error) {
    return { authenticated: false, error: 'Invalid or expired token' };
  }
}

/**
 * Netlify Serverless Function
 * Handles GET (fetch campaigns) and POST (create campaign) requests
 * 
 * GET: /api/campaigns - Fetch all campaigns (authenticated users)
 * POST: /api/campaigns - Create a new campaign (admin only)
 */
export const handler = async (event, context) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': event.headers.origin || '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
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

    // GET - Fetch all campaigns (accessible to all authenticated users)
    if (event.httpMethod === 'GET') {
      const campaigns = await db`
        SELECT id, name, google_link, yelp_link, logo_url, primary_color, secondary_color, background_color, created_at
        FROM campaigns
        ORDER BY created_at DESC
      `;

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(campaigns),
      };
    }

    // POST - Create a new campaign (admin only)
    if (event.httpMethod === 'POST') {
      // Verify admin authentication
      const auth = await verifyAdmin(event);
      if (!auth.authenticated) {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({ error: auth.error }),
        };
      }

      const { 
        name, 
        googleLink, 
        yelpLink, 
        logoUrl, 
        primaryColor, 
        secondaryColor, 
        backgroundColor 
      } = JSON.parse(event.body);

      if (!name) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Campaign name is required' }),
        };
      }

      const [campaign] = await db`
        INSERT INTO campaigns (name, google_link, yelp_link, logo_url, primary_color, secondary_color, background_color)
        VALUES (
          ${name}, 
          ${googleLink || null}, 
          ${yelpLink || null}, 
          ${logoUrl || null}, 
          ${primaryColor || null}, 
          ${secondaryColor || null}, 
          ${backgroundColor || null}
        )
        RETURNING id, name, google_link, yelp_link, logo_url, primary_color, secondary_color, background_color, created_at
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

