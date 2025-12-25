import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import { existsSync } from 'fs';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file if it exists
const envPath = join(__dirname, '..', '.env');
if (existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

// Get connection string from environment variable
const connectionString = process.env.NETLIFY_DATABASE_URL || process.env.DATABASE_URL;

if (!connectionString) {
  console.error('Error: NETLIFY_DATABASE_URL or DATABASE_URL environment variable is not set');
  console.error('Please set it with: export NETLIFY_DATABASE_URL="your_connection_string"');
  process.exit(1);
}

const client = new Client({
  connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

// Read and parse SQL file
const sqlFile = join(__dirname, '..', 'netlify', 'functions', 'migrate-add-role.sql');
const sqlContent = readFileSync(sqlFile, 'utf-8');

async function migrateDatabase() {
  try {
    console.log('🚀 Connecting to Neon database...');
    await client.connect();
    console.log('✅ Connected to database\n');

    console.log('📝 Running migration: Add role column to users table...\n');
    
    await client.query(sqlContent);
    
    console.log('✅ Migration completed successfully!');
    console.log('\nAll existing users have been set to "admin" role.');
    console.log('New users will default to "user" role unless specified.');
    
    await client.end();
    
  } catch (error) {
    console.error('\n❌ Migration failed:');
    console.error(error.message);
    if (client._connected) {
      await client.end();
    }
    process.exit(1);
  }
}

migrateDatabase();

