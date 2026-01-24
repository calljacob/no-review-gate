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

    // GET - Fetch reviews (optionally filtered by campaignId, leadId, or projectId)
    if (event.httpMethod === 'GET') {
      const { campaignId, leadId, projectId } = event.queryStringParameters || {};

      // Check if project_id column exists
      const [columnCheck] = await db`
        SELECT EXISTS (
          SELECT 1 
          FROM information_schema.columns 
          WHERE table_name = 'reviews' 
          AND column_name = 'project_id'
        ) as project_id_exists
      `;

      let reviews;
      if (campaignId && (leadId || projectId)) {
        const campaignIdInt = parseInt(campaignId, 10);
        if (isNaN(campaignIdInt) || campaignIdInt <= 0) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Invalid campaign ID' }),
          };
        }
        
        if (leadId) {
          const leadIdValidation = validateTextLength(leadId, 255, 'Lead ID');
          if (!leadIdValidation.valid) {
            return {
              statusCode: 400,
              headers,
              body: JSON.stringify({ error: leadIdValidation.error }),
            };
          }
          
          if (columnCheck?.project_id_exists) {
            reviews = await db`
              SELECT id, lead_id, project_id, campaign_id, rating, feedback, created_at
              FROM reviews
              WHERE campaign_id = ${campaignIdInt} AND lead_id = ${leadId}
              ORDER BY created_at DESC
            `;
          } else {
            reviews = await db`
              SELECT id, lead_id, campaign_id, rating, feedback, created_at
              FROM reviews
              WHERE campaign_id = ${campaignIdInt} AND lead_id = ${leadId}
              ORDER BY created_at DESC
            `;
          }
        } else if (projectId) {
          const projectIdValidation = validateTextLength(projectId, 255, 'Project ID');
          if (!projectIdValidation.valid) {
            return {
              statusCode: 400,
              headers,
              body: JSON.stringify({ error: projectIdValidation.error }),
            };
          }
          
          if (columnCheck?.project_id_exists) {
            reviews = await db`
              SELECT id, lead_id, project_id, campaign_id, rating, feedback, created_at
              FROM reviews
              WHERE campaign_id = ${campaignIdInt} AND project_id = ${projectId}
              ORDER BY created_at DESC
            `;
          } else {
            return {
              statusCode: 400,
              headers,
              body: JSON.stringify({ error: 'Project ID column does not exist in database. Please run migration.' }),
            };
          }
        }
      } else if (campaignId) {
        const campaignIdInt = parseInt(campaignId, 10);
        if (isNaN(campaignIdInt) || campaignIdInt <= 0) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Invalid campaign ID' }),
          };
        }
        
        if (columnCheck?.project_id_exists) {
          reviews = await db`
            SELECT id, lead_id, project_id, campaign_id, rating, feedback, created_at
            FROM reviews
            WHERE campaign_id = ${campaignIdInt}
            ORDER BY created_at DESC
          `;
        } else {
          reviews = await db`
            SELECT id, lead_id, campaign_id, rating, feedback, created_at
            FROM reviews
            WHERE campaign_id = ${campaignIdInt}
            ORDER BY created_at DESC
          `;
        }
      } else {
        if (columnCheck?.project_id_exists) {
          reviews = await db`
            SELECT id, lead_id, project_id, campaign_id, rating, feedback, created_at
            FROM reviews
            ORDER BY created_at DESC
            LIMIT 100
          `;
        } else {
          reviews = await db`
            SELECT id, lead_id, campaign_id, rating, feedback, created_at
            FROM reviews
            ORDER BY created_at DESC
            LIMIT 100
          `;
        }
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

      const { leadId, projectId, campaignId, rating, feedback } = parseResult.data;

      // Validate inputs
      const campaignIdInt = parseInt(campaignId, 10);
      if (isNaN(campaignIdInt) || campaignIdInt <= 0) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Invalid campaign ID' }),
        };
      }

      if (!rating) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'rating and campaignId are required' }),
        };
      }

      // Fetch campaign to determine its type
      const [campaign] = await db`
        SELECT campaign_type
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

      // Check if project_id column exists
      const [columnCheck] = await db`
        SELECT EXISTS (
          SELECT 1 
          FROM information_schema.columns 
          WHERE table_name = 'reviews' 
          AND column_name = 'project_id'
        ) as project_id_exists
      `;

      // Determine which identifier to use based on campaign type
      let identifierValue = null;
      let identifierField = null;

      // Check campaign type - default to 'lead_docket' if column doesn't exist
      const campaignType = campaign.campaign_type || 'lead_docket';

      if (campaignType === 'lead_docket') {
        if (!leadId) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'leadId is required for Lead Docket campaigns' }),
          };
        }
        identifierValue = leadId;
        identifierField = 'lead_id';
      } else if (campaignType === 'filevine') {
        if (!projectId) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'projectId is required for Filevine campaigns' }),
          };
        }
        if (!columnCheck?.project_id_exists) {
          return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Project ID column does not exist in database. Please run migration.' }),
          };
        }
        identifierValue = projectId;
        identifierField = 'project_id';
      } else {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Invalid campaign type' }),
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

      const identifierValidation = validateTextLength(identifierValue, 255, identifierField === 'lead_id' ? 'Lead ID' : 'Project ID');
      if (!identifierValidation.valid) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: identifierValidation.error }),
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

      let review;
      if (identifierField === 'lead_id') {
        // Insert with lead_id (project_id will be null)
        if (columnCheck?.project_id_exists) {
          [review] = await db`
            INSERT INTO reviews (lead_id, project_id, campaign_id, rating, feedback, created_at)
            VALUES (${identifierValue}, NULL, ${campaignIdInt}, ${ratingInt}, ${feedback || null}, NOW())
            RETURNING id, lead_id, project_id, campaign_id, rating, feedback, created_at
          `;
        } else {
          [review] = await db`
            INSERT INTO reviews (lead_id, campaign_id, rating, feedback, created_at)
            VALUES (${identifierValue}, ${campaignIdInt}, ${ratingInt}, ${feedback || null}, NOW())
            RETURNING id, lead_id, campaign_id, rating, feedback, created_at
          `;
        }
      } else {
        // Insert with project_id (lead_id will be null)
        [review] = await db`
          INSERT INTO reviews (lead_id, project_id, campaign_id, rating, feedback, created_at)
          VALUES (NULL, ${identifierValue}, ${campaignIdInt}, ${ratingInt}, ${feedback || null}, NOW())
          RETURNING id, lead_id, project_id, campaign_id, rating, feedback, created_at
        `;
      }

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

