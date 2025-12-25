import { getDb } from './utils/db.js';
import jwt from 'jsonwebtoken';
import { getCorsHeaders, isValidUrl, safeJsonParse, validateTextLength } from './utils/security.js';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET === 'your-secret-key-change-in-production') {
  throw new Error('JWT_SECRET environment variable must be set to a secure value in production');
}

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
  // Get CORS headers with proper origin validation
  const headers = getCorsHeaders(event);

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
      try {
        // Check if enabled column exists
        const [columnCheck] = await db`
          SELECT EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_name = 'campaigns' 
            AND column_name = 'enabled'
          ) as column_exists
        `;

        let campaigns;
        if (columnCheck?.column_exists) {
          // Column exists, include it in query
          campaigns = await db`
            SELECT id, name, google_link, yelp_link, logo_url, primary_color, secondary_color, background_color, enabled, created_at
            FROM campaigns
            ORDER BY created_at DESC
          `;
        } else {
          // Column doesn't exist, query without it (default enabled to true)
          campaigns = await db`
            SELECT id, name, google_link, yelp_link, logo_url, primary_color, secondary_color, background_color, true as enabled, created_at
            FROM campaigns
            ORDER BY created_at DESC
          `;
        }

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(campaigns),
        };
      } catch (dbError) {
        console.error('Error fetching campaigns from database:', dbError);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: 'Failed to fetch campaigns', message: dbError.message }),
        };
      }
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

      // Safely parse JSON
      const parseResult = safeJsonParse(event.body);
      if (!parseResult.success) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: parseResult.error }),
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
      } = parseResult.data;

      // Validate campaign name
      if (!name) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Campaign name is required' }),
        };
      }

      const nameValidation = validateTextLength(name, 255, 'Campaign name');
      if (!nameValidation.valid) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: nameValidation.error }),
        };
      }

      // Validate Google Place ID (if provided, must be a string)
      if (googleLink !== undefined && googleLink !== null) {
        if (typeof googleLink !== 'string') {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Google Place ID must be a valid string' }),
          };
        }
        // Allow empty string (it will be converted to null)
      }
      if (yelpLink && !isValidUrl(yelpLink)) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Invalid Yelp link URL format' }),
        };
      }
      if (logoUrl && !isValidUrl(logoUrl) && !logoUrl.startsWith('/api/serve-logo')) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Invalid logo URL format' }),
        };
      }

      // Check if enabled column exists before INSERT
      const [columnCheck] = await db`
        SELECT EXISTS (
          SELECT 1 
          FROM information_schema.columns 
          WHERE table_name = 'campaigns' 
          AND column_name = 'enabled'
        ) as column_exists
      `;

      let campaign;
      if (columnCheck?.column_exists) {
        // Column exists, include it in INSERT
        [campaign] = await db`
          INSERT INTO campaigns (name, google_link, yelp_link, logo_url, primary_color, secondary_color, background_color, enabled)
          VALUES (
            ${name}, 
            ${googleLink || null}, 
            ${yelpLink || null}, 
            ${logoUrl || null}, 
            ${primaryColor || null}, 
            ${secondaryColor || null}, 
            ${backgroundColor || null},
            true
          )
          RETURNING id, name, google_link, yelp_link, logo_url, primary_color, secondary_color, background_color, enabled, created_at
        `;
      } else {
        // Column doesn't exist, INSERT without it
        [campaign] = await db`
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
        // Add enabled as true to the response
        campaign = { ...campaign, enabled: true };
      }

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

