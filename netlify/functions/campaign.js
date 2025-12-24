import { getDb } from './utils/db.js';

/**
 * Netlify Serverless Function
 * Handles GET, PUT, and DELETE requests for a specific campaign
 * 
 * GET: /api/campaign/:id - Get a specific campaign
 * PUT: /api/campaign/:id - Update a campaign
 * DELETE: /api/campaign/:id - Delete a campaign
 */
export const handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json',
  };

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
    
    if (!campaignId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Campaign ID is required' }),
      };
    }

    // GET - Fetch a specific campaign
    if (event.httpMethod === 'GET') {
      const [campaign] = await db`
        SELECT id, name, google_link, yelp_link, created_at
        FROM campaigns
        WHERE id = ${campaignId}
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

    // PUT - Update a campaign
    if (event.httpMethod === 'PUT') {
      const { name, googleLink, yelpLink } = JSON.parse(event.body);

      const [updatedCampaign] = await db`
        UPDATE campaigns
        SET 
          name = ${name},
          google_link = ${googleLink || null},
          yelp_link = ${yelpLink || null}
        WHERE id = ${campaignId}
        RETURNING id, name, google_link, yelp_link, created_at
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

    // DELETE - Delete a campaign
    if (event.httpMethod === 'DELETE') {
      const [deletedCampaign] = await db`
        DELETE FROM campaigns
        WHERE id = ${campaignId}
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

