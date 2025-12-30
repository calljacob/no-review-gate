import { Storage } from '@google-cloud/storage';
import crypto from 'crypto';
import { safeJsonParse, validateTextLength } from './utils/security.js';

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
  } else if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    // Check if we have any credentials at all
    throw new Error('GCS credentials not found. Please set GCS_SERVICE_ACCOUNT_KEY or GOOGLE_APPLICATION_CREDENTIALS environment variable.');
  }

  return new Storage(storageOptions);
}

// Lazy initialization - only create client when needed
let storage = null;
function getStorage() {
  if (!storage) {
    storage = getStorageClient();
  }
  return storage;
}

/**
 * Netlify Serverless Function
 * Handles POST requests to upload campaign logos to Google Cloud Storage
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
    const objectName = campaignIdInt 
      ? `campaign-logos/campaign-${campaignIdInt}-${uniqueId}.${fileExt}`
      : `campaign-logos/logo-${uniqueId}.${fileExt}`;

    // Get storage client (lazy initialization)
    const storageClient = getStorage();
    
    // Get bucket reference
    const bucket = storageClient.bucket(BUCKET_NAME);

    // Convert base64 string to buffer for storage
    const fileBuffer = Buffer.from(base64Data, 'base64');
    
    // Upload file to Google Cloud Storage
    const file = bucket.file(objectName);
    await file.save(fileBuffer, {
      metadata: {
        contentType: fileContentType,
        metadata: {
          originalFilename: filename,
          uploadedAt: new Date().toISOString(),
          campaignId: campaignIdInt?.toString() || null,
        },
      },
    });

    // Make the file publicly accessible
    await file.makePublic();

    // Get the public URL
    const publicUrl = `https://storage.googleapis.com/${BUCKET_NAME}/${objectName}`;

    // Return the object name (this will be stored as logo_url in the database)
    // We can store either the object name or the full URL - storing object name for flexibility
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        blobKey: objectName, // Keep same key name for backward compatibility
        url: publicUrl, // Public URL for direct access
      }),
    };
  } catch (error) {
    console.error('Upload error:', error);
    console.error('Error stack:', error.stack);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      name: error.name,
    });
    
    // Provide more helpful error messages
    let errorMessage = error.message || 'Failed to upload logo';
    if (error.message?.includes('credentials')) {
      errorMessage = 'Google Cloud Storage credentials not configured. Please set GCS_SERVICE_ACCOUNT_KEY environment variable.';
    } else if (error.message?.includes('bucket') || error.code === 404) {
      errorMessage = `Bucket '${BUCKET_NAME}' not found. Please verify the bucket exists and credentials have access.`;
    } else if (error.code === 403 || error.message?.includes('permission')) {
      errorMessage = 'Permission denied. Please check that the service account has Storage Object Admin permissions.';
    }
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Failed to upload logo', 
        message: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      }),
    };
  }
};

