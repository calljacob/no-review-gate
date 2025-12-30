import { neon } from '@neondatabase/serverless';

/**
 * Get a Neon database client connection
 * Uses pooled connection by default for better performance in serverless environments
 */
export function getDb() {
  // Use the pooled connection URL (NETLIFY_DATABASE_URL) for serverless functions
  const connectionString = process.env.NETLIFY_DATABASE_URL;
  
  if (!connectionString) {
    throw new Error('NETLIFY_DATABASE_URL environment variable is not set');
  }
  
  return neon(connectionString);
}

/**
 * Execute a SQL query and return the result
 * @param {string} sql - SQL query string
 * @param {Array} params - Query parameters (optional)
 * @returns {Promise<Array>} Query results
 */
export async function query(sql, params = []) {
  const db = getDb();
  return await db(sql, params);
}


