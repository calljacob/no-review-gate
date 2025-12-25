import { getDb } from './utils/db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getCorsHeaders, isValidEmail, validatePassword, safeJsonParse } from './utils/security.js';

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
 * Handles user management: create, list, update, delete users
 * Requires admin authentication
 * 
 * GET /api/users - List all users
 * POST /api/users - Create a new user
 * PUT /api/users/:id - Update a user
 * DELETE /api/users/:id - Delete a user
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
    // Verify admin authentication
    const auth = await verifyAdmin(event);
    if (!auth.authenticated) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: auth.error }),
      };
    }

    const db = getDb();
    
    // Extract user ID from path or query parameters
    let userId = event.queryStringParameters?.id;
    if (!userId && event.path) {
      const pathParts = event.path.split('/').filter(p => p);
      const userIndex = pathParts.indexOf('users');
      if (userIndex !== -1 && pathParts[userIndex + 1]) {
        userId = pathParts[userIndex + 1];
      } else if (pathParts.length > 0) {
        // Try last part of path
        const lastPart = pathParts[pathParts.length - 1];
        if (lastPart && !isNaN(lastPart)) {
          userId = lastPart;
        }
      }
    }

    // GET /api/users - List all users
    if (event.httpMethod === 'GET') {
      const users = await db`
        SELECT id, email, role, created_at, updated_at
        FROM users
        ORDER BY created_at DESC
      `;

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(users),
      };
    }

    // POST /api/users - Create a new user
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

      const { email, password, role = 'user' } = parseResult.data;

      if (!email || !password) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Email and password are required' }),
        };
      }

      // Validate email format
      if (!isValidEmail(email)) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Invalid email format' }),
        };
      }

      if (role !== 'admin' && role !== 'user') {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Role must be either "admin" or "user"' }),
        };
      }

      // Validate password strength
      const passwordValidation = validatePassword(password);
      if (!passwordValidation.valid) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: passwordValidation.error }),
        };
      }

      // Check if user already exists
      const [existing] = await db`
        SELECT id FROM users WHERE email = ${email.toLowerCase().trim()}
      `;

      if (existing) {
        return {
          statusCode: 409,
          headers,
          body: JSON.stringify({ error: 'User with this email already exists' }),
        };
      }

      // Hash password
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      // Create user
      const [newUser] = await db`
        INSERT INTO users (email, password_hash, role)
        VALUES (${email.toLowerCase().trim()}, ${passwordHash}, ${role})
        RETURNING id, email, role, created_at
      `;

      return {
        statusCode: 201,
        headers,
        body: JSON.stringify(newUser),
      };
    }

    // PUT /api/users/:id - Update a user
    if (event.httpMethod === 'PUT' && userId) {
      // Safely parse JSON
      const parseResult = safeJsonParse(event.body);
      if (!parseResult.success) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: parseResult.error }),
        };
      }

      const { email, role, password } = parseResult.data;
      const userIdInt = parseInt(userId, 10);
      
      if (isNaN(userIdInt) || userIdInt <= 0) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Invalid user ID' }),
        };
      }

      // Get current user
      const [currentUser] = await db`
        SELECT id, email, role FROM users WHERE id = ${userIdInt}
      `;

      if (!currentUser) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'User not found' }),
        };
      }

      // Check email if provided
      if (email !== undefined && email !== currentUser.email) {
        // Validate email format
        if (!isValidEmail(email)) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Invalid email format' }),
          };
        }
        
        const [existing] = await db`
          SELECT id FROM users WHERE email = ${email.toLowerCase().trim()} AND id != ${userIdInt}
        `;
        if (existing) {
          return {
            statusCode: 409,
            headers,
            body: JSON.stringify({ error: 'Email already in use' }),
          };
        }
      }

      // Validate role if provided
      if (role !== undefined && role !== currentUser.role) {
        if (role !== 'admin' && role !== 'user') {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Role must be either "admin" or "user"' }),
          };
        }
      }

      // Validate password if provided
      if (password !== undefined) {
        const passwordValidation = validatePassword(password);
        if (!passwordValidation.valid) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: passwordValidation.error }),
          };
        }
      }

      // Build update - use COALESCE to only update if value is provided
      let updatedEmail = email !== undefined ? email.toLowerCase().trim() : currentUser.email;
      let updatedRole = role !== undefined ? role : currentUser.role;
      let updatedPasswordHash = currentUser.password_hash;

      if (password !== undefined) {
        const saltRounds = 10;
        updatedPasswordHash = await bcrypt.hash(password, saltRounds);
      }

      const [updatedUser] = await db`
        UPDATE users
        SET 
          email = ${updatedEmail},
          role = ${updatedRole},
          password_hash = ${updatedPasswordHash},
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ${userIdInt}
        RETURNING id, email, role, created_at, updated_at
      `;

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(updatedUser),
      };
    }

    // DELETE /api/users/:id - Delete a user
    if (event.httpMethod === 'DELETE' && userId) {
      const userIdInt = parseInt(userId, 10);
      
      if (isNaN(userIdInt) || userIdInt <= 0) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Invalid user ID' }),
        };
      }

      // Prevent deleting yourself
      if (userIdInt === auth.userId) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Cannot delete your own account' }),
        };
      }

      const [deleted] = await db`
        DELETE FROM users
        WHERE id = ${userIdInt}
        RETURNING id, email
      `;

      if (!deleted) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'User not found' }),
        };
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, message: 'User deleted successfully' }),
      };
    }

    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  } catch (error) {
    console.error('Users management error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error', message: error.message }),
    };
  }
};

