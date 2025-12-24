# Neon Database Setup

This project uses [Neon](https://neon.tech) as the database service, integrated with Netlify serverless functions.

## Environment Variables

Netlify automatically provides these environment variables when configured in your dashboard:

- `NETLIFY_DATABASE_URL` - Pooled connection (recommended for serverless)
- `NETLIFY_DATABASE_URL_UNPOOLED` - Direct connection

Configure these in your Netlify dashboard:
**Site settings > Environment variables**

## Database Schema Setup

1. Open your Neon dashboard SQL editor
2. Run the SQL script from `netlify/functions/setup-db.sql`
3. This will create the necessary tables and indexes (including the `users` table for authentication)

## Authentication Setup

After setting up the database schema, create an admin user:

```bash
npm run db:create-admin
```

This will create an admin user with:
- Email: `alberto@calljacob.com`
- Password: `123456`

**Note:** Make sure to change the default password after first login for security.

### Creating Additional Users

To create additional admin users, you can modify the `scripts/create-admin-user.js` file with different credentials, or add them directly via SQL:

```sql
INSERT INTO users (email, password_hash) 
VALUES ('user@example.com', '$2a$10$...hashed_password...');
```

Use bcrypt to hash passwords (10 salt rounds recommended).

## Available API Endpoints

### Campaigns

- `GET /api/campaigns` - Fetch all campaigns
- `POST /api/campaigns` - Create a new campaign
  ```json
  {
    "name": "Campaign Name",
    "googleLink": "https://...",
    "yelpLink": "https://..."
  }
  ```

### Single Campaign

- `GET /api/campaign/:id` - Get a specific campaign
- `PUT /api/campaign/:id` - Update a campaign
- `DELETE /api/campaign/:id` - Delete a campaign

### Reviews

- `GET /api/reviews` - Get all reviews (or filter with `?campaignId=xxx&leadId=xxx`)
- `POST /api/reviews` - Submit a new review
  ```json
  {
    "leadId": "12345",
    "campaignId": "1",
    "rating": 5,
    "feedback": "Great service!"
  }
  ```

### Authentication

- `POST /api/auth/login` - Login with email and password
  ```json
  {
    "email": "admin@example.com",
    "password": "password123"
  }
  ```
  Returns a JWT token stored in an HttpOnly cookie.

- `POST /api/auth/logout` - Logout (clears authentication cookie)

- `GET /api/auth/verify` - Verify current session token
  Returns user information if authenticated.

- `POST /api/change-password` - Change password (requires authentication)
  ```json
  {
    "currentPassword": "oldpassword",
    "newPassword": "newpassword"
  }
  ```

## Local Development

For local development, you'll need to set environment variables:

1. Copy your connection string from Netlify
2. Create a `.env` file in the root directory:
   ```
   NETLIFY_DATABASE_URL=postgresql://...
   ```

3. Use Netlify CLI to run functions locally:
   ```bash
   npm install -g netlify-cli
   netlify dev
   ```

## Database Utilities

The `netlify/functions/utils/db.js` file provides helper functions:

- `getDb()` - Get a Neon database client
- `query(sql, params)` - Execute a SQL query

## Environment Variables for Authentication

For production, set a secure JWT secret in Netlify:

- `JWT_SECRET` - Secret key for signing JWT tokens (use a strong random string in production)

Configure in Netlify dashboard:
**Site settings > Environment variables**

If not set, a default secret is used (not recommended for production).

## Notes

- The Neon serverless driver automatically handles connection pooling
- Use `NETLIFY_DATABASE_URL` (pooled) for serverless functions
- All functions include CORS headers for frontend access
- Authentication uses JWT tokens stored in HttpOnly cookies for security
- The `/admin` route is protected and requires authentication
- Users can change their password from the admin dashboard

