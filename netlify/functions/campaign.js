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
 * Handles GET, PUT, and DELETE requests for a specific campaign
 * 
 * GET: /api/campaign/:id - Get a specific campaign (authenticated users)
 * PUT: /api/campaign/:id - Update a campaign (admin only)
 * DELETE: /api/campaign/:id - Delete a campaign (admin only)
 */
export const handler = async (event, context) => {
  // Get CORS headers with proper origin validation
  const headers = getCorsHeaders(event);

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  try {
    const db = getDb();
    // Extract campaign ID from path or query parameters
    // Path format: /api/campaign/123 or /.netlify/functions/campaign?id=123
    let campaignId = event.queryStringParameters?.id;
    
    // If not in query params, try to extract from path
    if (!campaignId && event.path) {
      const pathParts = event.path.split('/').filter(Boolean);
      const campaignIndex = pathParts.indexOf('campaign');
      if (campaignIndex !== -1 && pathParts[campaignIndex + 1]) {
        campaignId = pathParts[campaignIndex + 1];
      }
    }
    
    // Validate campaign ID
    if (!campaignId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Campaign ID is required' }),
      };
    }

    const campaignIdInt = parseInt(campaignId, 10);
    if (isNaN(campaignIdInt) || campaignIdInt <= 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid campaign ID' }),
      };
    }

    // GET - Fetch a specific campaign
    if (event.httpMethod === 'GET') {
      const [campaign] = await db`
        SELECT id, name, google_link, yelp_link, logo_url, primary_color, secondary_color, background_color, created_at
        FROM campaigns
        WHERE id = ${campaignIdInt}
      `;

      if (!campaign) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Campaign not found' }),
        };
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(campaign),
      };
    }

    // PUT - Update a campaign (admin only)
    if (event.httpMethod === 'PUT') {
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

      // Validate inputs
      if (name !== undefined) {
        const nameValidation = validateTextLength(name, 255, 'Campaign name');
        if (!nameValidation.valid) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: nameValidation.error }),
          };
        }
      }

      if (googleLink && !isValidUrl(googleLink)) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Invalid Google link URL format' }),
        };
      }
      if (yelpLink && !isValidUrl(yelpLink)) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Invalid Yelp link URL format' }),
        };
      }

      const [updatedCampaign] = await db`
        UPDATE campaigns
        SET 
          name = ${name !== undefined ? name : null},
          google_link = ${googleLink || null},
          yelp_link = ${yelpLink || null},
          logo_url = ${logoUrl !== undefined ? logoUrl : null},
          primary_color = ${primaryColor || null},
          secondary_color = ${secondaryColor || null},
          background_color = ${backgroundColor || null}
        WHERE id = ${campaignIdInt}
        RETURNING id, name, google_link, yelp_link, logo_url, primary_color, secondary_color, background_color, created_at
      `;

      if (!updatedCampaign) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Campaign not found' }),
        };
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(updatedCampaign),
      };
    }

    // DELETE - Delete a campaign (admin only)
    if (event.httpMethod === 'DELETE') {
      // Verify admin authentication
      const auth = await verifyAdmin(event);
      if (!auth.authenticated) {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({ error: auth.error }),
        };
      }

      const [deletedCampaign] = await db`
        DELETE FROM campaigns
        WHERE id = ${campaignIdInt}
        RETURNING id
      `;

      if (!deletedCampaign) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Campaign not found' }),
        };
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ message: 'Campaign deleted successfully' }),
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

