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
      try {
        // Check if enabled and campaign_type columns exist
        const [columnCheck] = await db`
          SELECT 
            EXISTS (
              SELECT 1 
              FROM information_schema.columns 
              WHERE table_name = 'campaigns' 
              AND column_name = 'enabled'
            ) as enabled_exists,
            EXISTS (
              SELECT 1 
              FROM information_schema.columns 
              WHERE table_name = 'campaigns' 
              AND column_name = 'campaign_type'
            ) as campaign_type_exists
        `;

        let campaign;
        if (columnCheck?.enabled_exists && columnCheck?.campaign_type_exists) {
          // Both columns exist, include them in query
          [campaign] = await db`
            SELECT id, name, google_link, yelp_link, logo_url, primary_color, secondary_color, background_color, enabled, campaign_type, created_at
            FROM campaigns
            WHERE id = ${campaignIdInt}
          `;
        } else if (columnCheck?.enabled_exists) {
          // Only enabled exists
          [campaign] = await db`
            SELECT id, name, google_link, yelp_link, logo_url, primary_color, secondary_color, background_color, enabled, 'lead_docket' as campaign_type, created_at
            FROM campaigns
            WHERE id = ${campaignIdInt}
          `;
        } else if (columnCheck?.campaign_type_exists) {
          // Only campaign_type exists
          [campaign] = await db`
            SELECT id, name, google_link, yelp_link, logo_url, primary_color, secondary_color, background_color, true as enabled, campaign_type, created_at
            FROM campaigns
            WHERE id = ${campaignIdInt}
          `;
        } else {
          // Neither column exists, query without them (default values)
          [campaign] = await db`
            SELECT id, name, google_link, yelp_link, logo_url, primary_color, secondary_color, background_color, true as enabled, 'lead_docket' as campaign_type, created_at
            FROM campaigns
            WHERE id = ${campaignIdInt}
          `;
        }

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
      } catch (dbError) {
        console.error('Error fetching campaign from database:', dbError);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: 'Failed to fetch campaign', message: dbError.message }),
        };
      }
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
        backgroundColor,
        enabled,
        campaignType
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

      // Validate campaign type if provided
      if (campaignType !== undefined && campaignType !== null) {
        const validCampaignType = campaignType === 'lead_docket' || campaignType === 'filevine';
        if (!validCampaignType) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Campaign type must be either "lead_docket" or "filevine"' }),
          };
        }
      }

      // Check if enabled and campaign_type columns exist
      const [columnCheck] = await db`
        SELECT 
          EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_name = 'campaigns' 
            AND column_name = 'enabled'
          ) as enabled_exists,
          EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_name = 'campaigns' 
            AND column_name = 'campaign_type'
          ) as campaign_type_exists
      `;

      // Get current campaign to preserve existing values if not provided
      let currentCampaign;
      if (columnCheck?.enabled_exists && columnCheck?.campaign_type_exists) {
        [currentCampaign] = await db`
          SELECT name, google_link, yelp_link, logo_url, primary_color, secondary_color, background_color, enabled, campaign_type
          FROM campaigns
          WHERE id = ${campaignIdInt}
        `;
      } else if (columnCheck?.enabled_exists) {
        [currentCampaign] = await db`
          SELECT name, google_link, yelp_link, logo_url, primary_color, secondary_color, background_color, enabled, 'lead_docket' as campaign_type
          FROM campaigns
          WHERE id = ${campaignIdInt}
        `;
      } else if (columnCheck?.campaign_type_exists) {
        [currentCampaign] = await db`
          SELECT name, google_link, yelp_link, logo_url, primary_color, secondary_color, background_color, true as enabled, campaign_type
          FROM campaigns
          WHERE id = ${campaignIdInt}
        `;
      } else {
        [currentCampaign] = await db`
          SELECT name, google_link, yelp_link, logo_url, primary_color, secondary_color, background_color, true as enabled, 'lead_docket' as campaign_type
          FROM campaigns
          WHERE id = ${campaignIdInt}
        `;
      }

      if (!currentCampaign) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Campaign not found' }),
        };
      }

      // Use provided values or keep existing ones
      const updatedName = name !== undefined ? name : currentCampaign.name;
      const updatedGoogleLink = googleLink !== undefined ? (googleLink || null) : currentCampaign.google_link;
      const updatedYelpLink = yelpLink !== undefined ? (yelpLink || null) : currentCampaign.yelp_link;
      const updatedLogoUrl = logoUrl !== undefined ? logoUrl : currentCampaign.logo_url;
      const updatedPrimaryColor = primaryColor !== undefined ? (primaryColor || null) : currentCampaign.primary_color;
      const updatedSecondaryColor = secondaryColor !== undefined ? (secondaryColor || null) : currentCampaign.secondary_color;
      const updatedBackgroundColor = backgroundColor !== undefined ? (backgroundColor || null) : currentCampaign.background_color;
      const updatedEnabled = enabled !== undefined ? enabled : currentCampaign.enabled;
      const updatedCampaignType = campaignType !== undefined ? campaignType : currentCampaign.campaign_type;

      let updatedCampaign;
      if (columnCheck?.enabled_exists && columnCheck?.campaign_type_exists) {
        // Both columns exist, include them in UPDATE
        [updatedCampaign] = await db`
          UPDATE campaigns
          SET 
            name = ${updatedName},
            google_link = ${updatedGoogleLink},
            yelp_link = ${updatedYelpLink},
            logo_url = ${updatedLogoUrl},
            primary_color = ${updatedPrimaryColor},
            secondary_color = ${updatedSecondaryColor},
            background_color = ${updatedBackgroundColor},
            enabled = ${updatedEnabled},
            campaign_type = ${updatedCampaignType}
          WHERE id = ${campaignIdInt}
          RETURNING id, name, google_link, yelp_link, logo_url, primary_color, secondary_color, background_color, enabled, campaign_type, created_at
        `;
      } else if (columnCheck?.enabled_exists) {
        // Only enabled exists
        [updatedCampaign] = await db`
          UPDATE campaigns
          SET 
            name = ${updatedName},
            google_link = ${updatedGoogleLink},
            yelp_link = ${updatedYelpLink},
            logo_url = ${updatedLogoUrl},
            primary_color = ${updatedPrimaryColor},
            secondary_color = ${updatedSecondaryColor},
            background_color = ${updatedBackgroundColor},
            enabled = ${updatedEnabled}
          WHERE id = ${campaignIdInt}
          RETURNING id, name, google_link, yelp_link, logo_url, primary_color, secondary_color, background_color, enabled, created_at
        `;
        updatedCampaign = { ...updatedCampaign, campaign_type: updatedCampaignType };
      } else if (columnCheck?.campaign_type_exists) {
        // Only campaign_type exists
        [updatedCampaign] = await db`
          UPDATE campaigns
          SET 
            name = ${updatedName},
            google_link = ${updatedGoogleLink},
            yelp_link = ${updatedYelpLink},
            logo_url = ${updatedLogoUrl},
            primary_color = ${updatedPrimaryColor},
            secondary_color = ${updatedSecondaryColor},
            background_color = ${updatedBackgroundColor},
            campaign_type = ${updatedCampaignType}
          WHERE id = ${campaignIdInt}
          RETURNING id, name, google_link, yelp_link, logo_url, primary_color, secondary_color, background_color, campaign_type, created_at
        `;
        updatedCampaign = { ...updatedCampaign, enabled: updatedEnabled };
      } else {
        // Neither column exists, UPDATE without them
        [updatedCampaign] = await db`
          UPDATE campaigns
          SET 
            name = ${updatedName},
            google_link = ${updatedGoogleLink},
            yelp_link = ${updatedYelpLink},
            logo_url = ${updatedLogoUrl},
            primary_color = ${updatedPrimaryColor},
            secondary_color = ${updatedSecondaryColor},
            background_color = ${updatedBackgroundColor}
          WHERE id = ${campaignIdInt}
          RETURNING id, name, google_link, yelp_link, logo_url, primary_color, secondary_color, background_color, created_at
        `;
        updatedCampaign = { ...updatedCampaign, enabled: updatedEnabled, campaign_type: updatedCampaignType };
      }

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

    // DELETE - Delete a campaign (disabled - campaigns can only be disabled, not deleted)
    if (event.httpMethod === 'DELETE') {
      return {
        statusCode: 405,
        headers,
        body: JSON.stringify({ error: 'Campaign deletion is not allowed. Please disable the campaign instead.' }),
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

