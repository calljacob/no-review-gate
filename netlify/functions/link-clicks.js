import { getDb } from './utils/db.js';
import { safeJsonParse, validateTextLength, isValidUrl } from './utils/security.js';

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
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
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

    const { campaignId, leadId, projectId, agent, buttonType, targetUrl } = parseResult.data;

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
      ) as table_exists
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

    const forwardedFor = event.headers['x-forwarded-for'] || '';
    const ipAddress = forwardedFor.split(',')[0]?.trim() || null;
    const userAgent = event.headers['user-agent'] || null;

    const [created] = await db`
      INSERT INTO link_clicks (campaign_id, lead_id, project_id, agent, button_type, target_url, user_agent, ip_address)
      VALUES (${campaignIdInt}, ${leadId || null}, ${projectId || null}, ${agent || null}, ${buttonType}, ${targetUrl}, ${userAgent}, ${ipAddress})
      RETURNING id, campaign_id, button_type, target_url, created_at
    `;

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
