import { getStore } from '@netlify/blobs';

/**
 * Netlify Serverless Function
 * Handles GET requests to serve campaign logos from Blobs
 * 
 * GET: /api/serve-logo?key=<blob-key> - Serve a logo image
 */
export const handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'public, max-age=31536000, immutable',
  };

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const blobKey = event.queryStringParameters?.key;

    if (!blobKey) {
      return {
        statusCode: 400,
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 'Blob key is required' }),
      };
    }

    // Get the blob from Netlify Blobs
    const store = getStore({
      name: 'campaign-logos',
      consistency: 'strong',
    });

    const blob = await store.get(blobKey, { type: 'arrayBuffer' });

    if (!blob) {
      return {
        statusCode: 404,
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 'Logo not found' }),
      };
    }

    // Determine content type from file extension
    const getContentType = (key) => {
      const ext = key.split('.').pop()?.toLowerCase();
      const typeMap = {
        'png': 'image/png',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'gif': 'image/gif',
        'svg': 'image/svg+xml',
        'webp': 'image/webp',
      };
      return typeMap[ext] || 'image/png';
    };
    
    const contentType = getContentType(blobKey);

    // Convert ArrayBuffer to base64 for response (required by Netlify Functions)
    // Note: While base64 adds ~33% overhead, it's required for binary data in serverless functions
    const buffer = Buffer.from(blob);
    const base64 = buffer.toString('base64');

    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Type': contentType,
        // Add ETag for better caching
        'ETag': `"${blobKey}"`,
        // Vary header for content negotiation
        'Vary': 'Accept-Encoding',
      },
      body: base64,
      isBase64Encoded: true,
    };
  } catch (error) {
    console.error('Serve logo error:', error);
    return {
      statusCode: 500,
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        error: 'Failed to serve logo', 
        message: error.message 
      }),
    };
  }
};

