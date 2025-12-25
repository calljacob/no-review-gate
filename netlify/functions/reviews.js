import { getDb } from './utils/db.js';
import { safeJsonParse, validateTextLength } from './utils/security.js';

/**
 * Netlify Serverless Function
 * Handles GET (fetch reviews) and POST (submit review) requests
 * 
 * GET: /api/reviews?leadId=xxx&campaignId=xxx - Get reviews for a campaign
 * POST: /api/reviews - Submit a new review
 */
export const handler = async (event, context) => {
  // Note: Reviews endpoint allows public access, so CORS is more permissive
  // Consider adding rate limiting in production
  const headers = {
    'Access-Control-Allow-Origin': '*', // Public endpoint - CORS allowed
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
        const campaignIdInt = parseInt(campaignId, 10);
        if (isNaN(campaignIdInt) || campaignIdInt <= 0) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Invalid campaign ID' }),
          };
        }
        
        const leadIdValidation = validateTextLength(leadId, 255, 'Lead ID');
        if (!leadIdValidation.valid) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: leadIdValidation.error }),
          };
        }
        
        reviews = await db`
          SELECT id, lead_id, campaign_id, rating, feedback, created_at
          FROM reviews
          WHERE campaign_id = ${campaignIdInt} AND lead_id = ${leadId}
          ORDER BY created_at DESC
        `;
      } else if (campaignId) {
        const campaignIdInt = parseInt(campaignId, 10);
        if (isNaN(campaignIdInt) || campaignIdInt <= 0) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Invalid campaign ID' }),
          };
        }
        
        reviews = await db`
          SELECT id, lead_id, campaign_id, rating, feedback, created_at
          FROM reviews
          WHERE campaign_id = ${campaignIdInt}
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
      // Safely parse JSON
      const parseResult = safeJsonParse(event.body);
      if (!parseResult.success) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: parseResult.error }),
        };
      }

      const { leadId, campaignId, rating, feedback } = parseResult.data;

      if (!leadId || !campaignId || !rating) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'leadId, campaignId, and rating are required' }),
        };
      }

      // Validate inputs
      const campaignIdInt = parseInt(campaignId, 10);
      if (isNaN(campaignIdInt) || campaignIdInt <= 0) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Invalid campaign ID' }),
        };
      }

      const ratingInt = parseInt(rating, 10);
      if (isNaN(ratingInt) || ratingInt < 1 || ratingInt > 5) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Rating must be a number between 1 and 5' }),
        };
      }

      const leadIdValidation = validateTextLength(leadId, 255, 'Lead ID');
      if (!leadIdValidation.valid) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: leadIdValidation.error }),
        };
      }

      const feedbackValidation = validateTextLength(feedback, 10000, 'Feedback');
      if (!feedbackValidation.valid) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: feedbackValidation.error }),
        };
      }

      const [review] = await db`
        INSERT INTO reviews (lead_id, campaign_id, rating, feedback, created_at)
        VALUES (${leadId}, ${campaignIdInt}, ${ratingInt}, ${feedback || null}, NOW())
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

