import { getDb } from './utils/db.js';

/**
 * Netlify Serverless Function
 * Handles GET (fetch reviews) and POST (submit review) requests
 * 
 * GET: /api/reviews?leadId=xxx&campaignId=xxx - Get reviews for a campaign
 * POST: /api/reviews - Submit a new review
 */
export const handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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

    // GET - Fetch reviews (optionally filtered by campaignId or leadId)
    if (event.httpMethod === 'GET') {
      const { campaignId, leadId } = event.queryStringParameters || {};

      let reviews;
      if (campaignId && leadId) {
        reviews = await db`
          SELECT id, lead_id, campaign_id, rating, feedback, created_at
          FROM reviews
          WHERE campaign_id = ${campaignId} AND lead_id = ${leadId}
          ORDER BY created_at DESC
        `;
      } else if (campaignId) {
        reviews = await db`
          SELECT id, lead_id, campaign_id, rating, feedback, created_at
          FROM reviews
          WHERE campaign_id = ${campaignId}
          ORDER BY created_at DESC
        `;
      } else {
        reviews = await db`
          SELECT id, lead_id, campaign_id, rating, feedback, created_at
          FROM reviews
          ORDER BY created_at DESC
          LIMIT 100
        `;
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(reviews),
      };
    }

    // POST - Submit a new review
    if (event.httpMethod === 'POST') {
      const { leadId, campaignId, rating, feedback } = JSON.parse(event.body);

      if (!leadId || !campaignId || !rating) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'leadId, campaignId, and rating are required' }),
        };
      }

      const [review] = await db`
        INSERT INTO reviews (lead_id, campaign_id, rating, feedback, created_at)
        VALUES (${leadId}, ${campaignId}, ${rating}, ${feedback || null}, NOW())
        RETURNING id, lead_id, campaign_id, rating, feedback, created_at
      `;

      return {
        statusCode: 201,
        headers,
        body: JSON.stringify(review),
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

