/**
 * Security utility functions for Netlify Functions
 */

/**
 * Get CORS headers with origin validation
 * @param {Object} event - Netlify function event
 * @returns {Object} CORS headers
 */
export function getCorsHeaders(event) {
  // Get allowed origins from environment variable (comma-separated)
  // Default to empty array, which means no CORS (same-origin only)
  const allowedOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : [];

  const requestOrigin = event.headers.origin || event.headers.referer?.split('/').slice(0, 3).join('/');

  // Determine if we should allow this origin
  let allowedOrigin = null;
  if (allowedOrigins.length === 0) {
    // No CORS configuration - same-origin only
    allowedOrigin = null;
  } else if (allowedOrigins.includes('*')) {
    // Explicit wildcard allowed (for public APIs only, never with credentials)
    allowedOrigin = '*';
  } else if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
    // Origin is in whitelist
    allowedOrigin = requestOrigin;
  }

  // Base headers
  const headers = {
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json',
  };

  // Add origin only if allowed
  if (allowedOrigin) {
    headers['Access-Control-Allow-Origin'] = allowedOrigin;
    // Only allow credentials if not using wildcard
    if (allowedOrigin !== '*') {
      headers['Access-Control-Allow-Credentials'] = 'true';
    }
  }

  return headers;
}

/**
 * Validate email format
 * @param {string} email - Email address to validate
 * @returns {boolean} True if valid
 */
export function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 255;
}

/**
 * Validate URL format
 * @param {string} url - URL to validate
 * @returns {boolean} True if valid
 */
export function isValidUrl(url) {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @returns {Object} { valid: boolean, error?: string }
 */
export function validatePassword(password) {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: 'Password is required' };
  }
  if (password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters long' };
  }
  if (password.length > 128) {
    return { valid: false, error: 'Password must be less than 128 characters' };
  }
  // Optional: Add more complex requirements
  // if (!/[A-Z]/.test(password)) {
  //   return { valid: false, error: 'Password must contain at least one uppercase letter' };
  // }
  // if (!/[a-z]/.test(password)) {
  //   return { valid: false, error: 'Password must contain at least one lowercase letter' };
  // }
  // if (!/\d/.test(password)) {
  //   return { valid: false, error: 'Password must contain at least one number' };
  // }
  return { valid: true };
}

/**
 * Safely parse JSON with error handling
 * @param {string} jsonString - JSON string to parse
 * @returns {Object} { success: boolean, data?: any, error?: string }
 */
export function safeJsonParse(jsonString) {
  if (!jsonString || typeof jsonString !== 'string') {
    return { success: false, error: 'Invalid JSON: empty or not a string' };
  }
  try {
    const data = JSON.parse(jsonString);
    return { success: true, data };
  } catch (error) {
    return { success: false, error: 'Invalid JSON format' };
  }
}

/**
 * Validate text input length
 * @param {string} text - Text to validate
 * @param {number} maxLength - Maximum allowed length
 * @param {string} fieldName - Name of the field for error messages
 * @returns {Object} { valid: boolean, error?: string }
 */
export function validateTextLength(text, maxLength, fieldName = 'Field') {
  if (text !== undefined && text !== null && typeof text !== 'string') {
    return { valid: false, error: `${fieldName} must be a string` };
  }
  if (text && text.length > maxLength) {
    return { valid: false, error: `${fieldName} must be less than ${maxLength} characters` };
  }
  return { valid: true };
}

