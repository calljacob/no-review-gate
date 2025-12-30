import { Storage } from '@google-cloud/storage';

const BUCKET_NAME = 'feedback-calljacob';

/**
 * Initialize Google Cloud Storage with proper credential handling
 * Supports credentials via:
 * 1. GCS_SERVICE_ACCOUNT_KEY - JSON string (recommended for Netlify)
 * 2. GOOGLE_APPLICATION_CREDENTIALS - Path to service account JSON file
 * 3. Default credentials from the environment (if running on GCP)
 */
function getStorageClient() {
  const storageOptions = {
    projectId: process.env.GCS_PROJECT_ID,
  };

  // If GCS_SERVICE_ACCOUNT_KEY is provided as JSON string, parse it
  if (process.env.GCS_SERVICE_ACCOUNT_KEY) {
    try {
      const credentials = JSON.parse(process.env.GCS_SERVICE_ACCOUNT_KEY);
      storageOptions.credentials = credentials;
    } catch (error) {
      console.error('Failed to parse GCS_SERVICE_ACCOUNT_KEY:', error);
      throw new Error('Invalid GCS_SERVICE_ACCOUNT_KEY format. Must be valid JSON.');
    }
  }

  return new Storage(storageOptions);
}

// Initialize Storage client
const storage = getStorageClient();

/**
 * Netlify Serverless Function
 * Handles GET requests to serve campaign logos from Google Cloud Storage
 * 
 * GET: /api/serve-logo?key=<object-name> - Serve a logo image
 * 
 * Note: Since files are made public in GCS, you can also use the direct public URL:
 * https://storage.googleapis.com/feedback-calljacob/<object-name>
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
    const objectName = event.queryStringParameters?.key;

    if (!objectName) {
      return {
        statusCode: 400,
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 'Object key is required' }),
      };
    }

    // Get the file from Google Cloud Storage
    const bucket = storage.bucket(BUCKET_NAME);
    const file = bucket.file(objectName);

    // Check if file exists
    const [exists] = await file.exists();
    if (!exists) {
      return {
        statusCode: 404,
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 'Logo not found' }),
      };
    }

    // Get file metadata to determine content type
    const [metadata] = await file.getMetadata();
    const contentType = metadata.contentType || (() => {
      const ext = objectName.split('.').pop()?.toLowerCase();
      const typeMap = {
        'png': 'image/png',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'gif': 'image/gif',
        'svg': 'image/svg+xml',
        'webp': 'image/webp',
      };
      return typeMap[ext] || 'image/png';
    })();

    // Download file content
    const [fileBuffer] = await file.download();
    const base64 = fileBuffer.toString('base64');

    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Type': contentType,
        // Add ETag for better caching
        'ETag': `"${objectName}"`,
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

