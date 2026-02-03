import { getDb } from './utils/db.js';
import { safeJsonParse, validateTextLength, isValidUrl } from './utils/security.js';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET === 'your-secret-key-change-in-production') {
  throw new Error('JWT_SECRET environment variable must be set to a secure value in production');
}

function verifyAuthenticated(event) {
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
    return { authenticated: true, userId: decoded.userId, role: decoded.role };
  } catch {
    return { authenticated: false, error: 'Invalid or expired token' };
  }
}

/**
 * Netlify Serverless Function
 * Handles POST requests to track outbound review button clicks
 *
 * POST: /api/link-clicks
 */
export const handler = async (event) => {
  // Public endpoint used by the review page
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

  if (event.httpMethod === 'GET') {
    try {
      const auth = verifyAuthenticated(event);
      if (!auth.authenticated) {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({ error: auth.error }),
        };
      }

      const db = getDb();
      const campaignId = event.queryStringParameters?.campaignId;
      const campaignIdInt = campaignId ? parseInt(campaignId, 10) : null;

      if (campaignId && (isNaN(campaignIdInt) || campaignIdInt <= 0)) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Invalid campaign ID' }),
        };
      }

      const [tableCheck] = await db`
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_name = 'link_clicks'
        ) as table_exists,
        EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = 'link_clicks'
          AND column_name = 'review_id'
        ) as review_id_exists
      `;

      if (!tableCheck?.table_exists) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify([]),
        };
      }

      let clicks;
      if (tableCheck?.review_id_exists) {
        if (campaignIdInt) {
          clicks = await db`
            SELECT id, campaign_id, review_id, lead_id, project_id, agent, button_type, target_url, created_at
            FROM link_clicks
            WHERE campaign_id = ${campaignIdInt}
            ORDER BY created_at DESC
            LIMIT 10000
          `;
        } else {
          clicks = await db`
            SELECT id, campaign_id, review_id, lead_id, project_id, agent, button_type, target_url, created_at
            FROM link_clicks
            ORDER BY created_at DESC
            LIMIT 10000
          `;
        }
      } else {
        if (campaignIdInt) {
          clicks = await db`
            SELECT id, campaign_id, NULL::integer as review_id, lead_id, project_id, agent, button_type, target_url, created_at
            FROM link_clicks
            WHERE campaign_id = ${campaignIdInt}
            ORDER BY created_at DESC
            LIMIT 10000
          `;
        } else {
          clicks = await db`
            SELECT id, campaign_id, NULL::integer as review_id, lead_id, project_id, agent, button_type, target_url, created_at
            FROM link_clicks
            ORDER BY created_at DESC
            LIMIT 10000
          `;
        }
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(clicks),
      };
    } catch (error) {
      console.error('Error fetching link clicks:', error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to fetch link clicks' }),
      };
    }
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const db = getDb();

    const parseResult = safeJsonParse(event.body);
    if (!parseResult.success) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: parseResult.error }),
      };
    }

    const { campaignId, reviewId, leadId, projectId, agent, buttonType, targetUrl } = parseResult.data;

    const campaignIdInt = parseInt(campaignId, 10);
    if (isNaN(campaignIdInt) || campaignIdInt <= 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid campaign ID' }),
      };
    }

    const validButtonType = buttonType === 'google' || buttonType === 'yelp';
    if (!validButtonType) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'buttonType must be "google" or "yelp"' }),
      };
    }

    if (!targetUrl || !isValidUrl(targetUrl)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'A valid targetUrl is required' }),
      };
    }

    let reviewIdInt = null;
    if (reviewId !== undefined && reviewId !== null && reviewId !== '') {
      reviewIdInt = parseInt(reviewId, 10);
      if (isNaN(reviewIdInt) || reviewIdInt <= 0) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Invalid review ID' }),
        };
      }
    }

    const leadValidation = validateTextLength(leadId, 255, 'Lead ID');
    if (!leadValidation.valid) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: leadValidation.error }),
      };
    }

    const projectValidation = validateTextLength(projectId, 255, 'Project ID');
    if (!projectValidation.valid) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: projectValidation.error }),
      };
    }

    const agentValidation = validateTextLength(agent, 255, 'Agent');
    if (!agentValidation.valid) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: agentValidation.error }),
      };
    }

    const [tableCheck] = await db`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_name = 'link_clicks'
      ) as table_exists,
      EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'link_clicks'
        AND column_name = 'review_id'
      ) as review_id_exists
    `;

    if (!tableCheck?.table_exists) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: 'Link click tracking is not set up. Run the link clicks migration first.',
        }),
      };
    }

    if (reviewIdInt && !tableCheck?.review_id_exists) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: 'review_id is missing on link_clicks. Run the latest link click migration.',
        }),
      };
    }

    const forwardedFor = event.headers['x-forwarded-for'] || '';
    const ipAddress = forwardedFor.split(',')[0]?.trim() || null;
    const userAgent = event.headers['user-agent'] || null;

    if (reviewIdInt) {
      const [review] = await db`
        SELECT id, campaign_id
        FROM reviews
        WHERE id = ${reviewIdInt}
      `;

      if (!review) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Review not found for provided reviewId' }),
        };
      }

      if (review.campaign_id !== campaignIdInt) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'reviewId does not belong to the provided campaignId' }),
        };
      }
    }

    let created;
    if (tableCheck?.review_id_exists) {
      [created] = await db`
        INSERT INTO link_clicks (campaign_id, review_id, lead_id, project_id, agent, button_type, target_url, user_agent, ip_address)
        VALUES (${campaignIdInt}, ${reviewIdInt}, ${leadId || null}, ${projectId || null}, ${agent || null}, ${buttonType}, ${targetUrl}, ${userAgent}, ${ipAddress})
        RETURNING id, campaign_id, review_id, button_type, target_url, created_at
      `;
    } else {
      [created] = await db`
        INSERT INTO link_clicks (campaign_id, lead_id, project_id, agent, button_type, target_url, user_agent, ip_address)
        VALUES (${campaignIdInt}, ${leadId || null}, ${projectId || null}, ${agent || null}, ${buttonType}, ${targetUrl}, ${userAgent}, ${ipAddress})
        RETURNING id, campaign_id, NULL::integer as review_id, button_type, target_url, created_at
      `;
    }

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify(created),
    };
  } catch (error) {
    console.error('Error tracking link click:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to track link click' }),
    };
  }
};
