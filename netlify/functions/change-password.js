import { getDb } from './utils/db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getCorsHeaders, validatePassword, safeJsonParse } from './utils/security.js';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET === 'your-secret-key-change-in-production') {
  throw new Error('JWT_SECRET environment variable must be set to a secure value in production');
}

/**
 * Netlify Serverless Function
 * Handles password changes for authenticated users
 * 
 * POST /api/change-password - Change user password
 * Requires: currentPassword, newPassword
 */
export const handler = async (event, context) => {
  // Get CORS headers with proper origin validation
  const headers = getCorsHeaders(event);

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  try {
    // Verify authentication
    const cookies = event.headers.cookie || '';
    const cookieToken = cookies.split(';').find(c => c.trim().startsWith('token='));
    const token = cookieToken 
      ? cookieToken.split('=')[1] 
      : event.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Authentication required' }),
      };
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (error) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Invalid or expired token' }),
      };
    }

    // POST /api/change-password
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

      const { currentPassword, newPassword } = parseResult.data;

      if (!currentPassword || !newPassword) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Current password and new password are required' }),
        };
      }

      // Validate new password strength
      const passwordValidation = validatePassword(newPassword);
      if (!passwordValidation.valid) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: passwordValidation.error }),
        };
      }

      const db = getDb();

      // Get user with password hash
      const [user] = await db`
        SELECT id, email, password_hash
        FROM users
        WHERE id = ${decoded.userId}
      `;

      if (!user) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'User not found' }),
        };
      }

      // Verify current password
      const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);
      if (!isValidPassword) {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({ error: 'Current password is incorrect' }),
        };
      }

      // Hash new password
      const saltRounds = 10;
      const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

      // Update password in database
      await db`
        UPDATE users
        SET password_hash = ${newPasswordHash}, updated_at = CURRENT_TIMESTAMP
        WHERE id = ${user.id}
      `;

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Password changed successfully',
        }),
      };
    }

    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  } catch (error) {
    console.error('Change password error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error', message: error.message }),
    };
  }
};

