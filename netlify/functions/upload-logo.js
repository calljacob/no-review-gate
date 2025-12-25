import { getStore } from '@netlify/blobs';
import crypto from 'crypto';
import { safeJsonParse, validateTextLength } from './utils/security.js';

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
    // Safely parse JSON
    const parseResult = safeJsonParse(event.body);
    if (!parseResult.success) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: parseResult.error }),
      };
    }

    const { base64, filename, contentType, campaignId } = parseResult.data;

    if (!base64 || !filename) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'base64 and filename are required' }),
      };
    }

    // Validate filename length
    const filenameValidation = validateTextLength(filename, 255, 'Filename');
    if (!filenameValidation.valid) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: filenameValidation.error }),
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

    // Validate file size (max 5MB for base64 encoded images)
    // Base64 encoding adds ~33% overhead, so 5MB base64 ≈ 3.75MB actual
    const maxBase64Size = 5 * 1024 * 1024; // 5MB
    if (base64Data.length > maxBase64Size) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'File size exceeds maximum limit of 5MB' }),
      };
    }

    // Validate campaign ID if provided
    let campaignIdInt = null;
    if (campaignId !== undefined && campaignId !== null) {
      campaignIdInt = parseInt(campaignId, 10);
      if (isNaN(campaignIdInt) || campaignIdInt <= 0) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Invalid campaign ID' }),
        };
      }
    }

    // Generate unique filename using campaign ID if provided, or random hash
    const fileExt = filename.split('.').pop() || 'png';
    const uniqueId = crypto.randomBytes(8).toString('hex');
    const blobKey = campaignIdInt 
      ? `campaign-${campaignIdInt}-${uniqueId}.${fileExt}`
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
        campaignId: campaignIdInt || null,
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

