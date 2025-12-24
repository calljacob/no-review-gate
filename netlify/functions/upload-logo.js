import { getStore } from '@netlify/blobs';
import crypto from 'crypto';

/**
 * Netlify Serverless Function
 * Handles POST requests to upload campaign logos
 * 
 * POST: /api/upload-logo - Upload a logo file
 * Body: JSON with { base64: string, filename: string, contentType: string, campaignId?: number }
 */
export const handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const { base64, filename, contentType, campaignId } = JSON.parse(event.body);

    if (!base64 || !filename) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'base64 and filename are required' }),
      };
    }

    // Validate file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/svg+xml', 'image/webp'];
    const fileContentType = contentType || 'image/png';
    
    if (!allowedTypes.includes(fileContentType)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid file type. Only images are allowed.' }),
      };
    }

    // Remove data URL prefix if present (e.g., "data:image/png;base64,")
    const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;

    // Generate unique filename using campaign ID if provided, or random hash
    const fileExt = filename.split('.').pop() || 'png';
    const uniqueId = crypto.randomBytes(8).toString('hex');
    const blobKey = campaignId 
      ? `campaign-${campaignId}-${uniqueId}.${fileExt}`
      : `logo-${uniqueId}.${fileExt}`;

    // Store in Netlify Blobs
    const store = getStore({
      name: 'campaign-logos',
      consistency: 'strong',
    });

    // Convert base64 string to buffer for storage
    const fileBuffer = Buffer.from(base64Data, 'base64');
    
    await store.set(blobKey, fileBuffer, {
      metadata: {
        filename,
        contentType: fileContentType,
        uploadedAt: new Date().toISOString(),
        campaignId: campaignId || null,
      },
    });

    // Return the blob key (this will be used as logo_url)
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        blobKey,
        url: `/api/serve-logo?key=${blobKey}`,
      }),
    };
  } catch (error) {
    console.error('Upload error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Failed to upload logo', 
        message: error.message 
      }),
    };
  }
};

