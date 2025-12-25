import { getDb } from './utils/db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = '7d';

/**
 * Netlify Serverless Function
 * Handles authentication: login, logout, and verify
 * 
 * POST /api/auth/login - Login with email and password
 * POST /api/auth/logout - Logout (clears token)
 * GET /api/auth/verify - Verify current session token
 */
export const handler = async (event, context) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': event.headers.origin || '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
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

  try {
    const db = getDb();
    // Extract the action from the path (login, logout, verify)
    // Handle both direct function calls and redirects
    const pathParts = event.path.split('/').filter(p => p);
    const action = pathParts[pathParts.length - 1] || 
                   (event.queryStringParameters?.action) ||
                   (event.path.includes('/login') ? 'login' : 
                    event.path.includes('/logout') ? 'logout' : 
                    event.path.includes('/verify') ? 'verify' : null);

    // POST /api/auth/login
    if (event.httpMethod === 'POST' && action === 'login') {
      const { email, password } = JSON.parse(event.body);

      if (!email || !password) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Email and password are required' }),
        };
      }

      // Find user by email
      const [user] = await db`
        SELECT id, email, password_hash, role
        FROM users
        WHERE email = ${email.toLowerCase().trim()}
      `;

      if (!user) {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({ error: 'Invalid email or password' }),
        };
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      if (!isValidPassword) {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({ error: 'Invalid email or password' }),
        };
      }

      // Generate JWT token
      const token = jwt.sign(
        { userId: user.id, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );

      // Set cookie with token
      const cookieHeader = `token=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${7 * 24 * 60 * 60}`;

      return {
        statusCode: 200,
        headers: {
          ...headers,
          'Set-Cookie': cookieHeader,
        },
        body: JSON.stringify({
          success: true,
          user: { id: user.id, email: user.email, role: user.role },
        }),
      };
    }

    // POST /api/auth/logout
    if (event.httpMethod === 'POST' && action === 'logout') {
      // Clear cookie by setting it to expire
      const cookieHeader = 'token=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0';

      return {
        statusCode: 200,
        headers: {
          ...headers,
          'Set-Cookie': cookieHeader,
        },
        body: JSON.stringify({ success: true, message: 'Logged out successfully' }),
      };
    }

    // GET /api/auth/verify
    if (event.httpMethod === 'GET' && action === 'verify') {
      // Get token from cookie or Authorization header
      const cookies = event.headers.cookie || '';
      const cookieToken = cookies.split(';').find(c => c.trim().startsWith('token='));
      const token = cookieToken 
        ? cookieToken.split('=')[1] 
        : event.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({ error: 'No token provided', authenticated: false }),
        };
      }

      try {
        // Verify token
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // Get user from database
        const [user] = await db`
          SELECT id, email, role
          FROM users
          WHERE id = ${decoded.userId}
        `;

        if (!user) {
          return {
            statusCode: 401,
            headers,
            body: JSON.stringify({ error: 'User not found', authenticated: false }),
          };
        }

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            authenticated: true,
            user: { id: user.id, email: user.email, role: user.role },
          }),
        };
      } catch (error) {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({ error: 'Invalid token', authenticated: false }),
        };
      }
    }

    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'Not found' }),
    };
  } catch (error) {
    console.error('Auth error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error', message: error.message }),
    };
  }
};

