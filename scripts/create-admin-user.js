import pg from 'pg';
import bcrypt from 'bcryptjs';
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

// Admin user credentials - get from environment variables or prompt
// For security, these should not be hardcoded
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'alberto@calljacob.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!ADMIN_PASSWORD) {
  console.error('❌ Error: ADMIN_PASSWORD environment variable is required');
  console.error('   Set it with: export ADMIN_PASSWORD="your-secure-password"');
  console.error('\n⚠️  Warning: Using default email. For production, also set ADMIN_EMAIL.');
  process.exit(1);
}

const client = new Client({
  connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

async function createAdminUser() {
  try {
    console.log('🚀 Connecting to Neon database...');
    await client.connect();
    console.log('✅ Connected to database\n');

    // Check if users table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      console.error('❌ Users table does not exist. Please run the database setup script first.');
      console.error('   Run: npm run db:setup');
      process.exit(1);
    }

    // Check if user already exists
    const existingUser = await client.query(
      'SELECT id, email FROM users WHERE email = $1',
      [ADMIN_EMAIL.toLowerCase().trim()]
    );

    if (existingUser.rows.length > 0) {
      console.log(`⚠️  User with email ${ADMIN_EMAIL} already exists.`);
      console.log('   Updating password...\n');
      
      // Hash the password
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, saltRounds);
      
      // Update existing user's password
      await client.query(
        'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE email = $2',
        [passwordHash, ADMIN_EMAIL.toLowerCase().trim()]
      );
      
      console.log('✅ Admin user password updated successfully!');
      console.log(`   Email: ${ADMIN_EMAIL}`);
      console.log(`   Password: ${ADMIN_PASSWORD}`);
    } else {
      console.log('📝 Creating admin user...\n');
      
      // Hash the password
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, saltRounds);
      
      // Insert new user
      const result = await client.query(
        'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, created_at',
        [ADMIN_EMAIL.toLowerCase().trim(), passwordHash]
      );
      
      const user = result.rows[0];
      console.log('✅ Admin user created successfully!');
      console.log(`   ID: ${user.id}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Password: ${ADMIN_PASSWORD}`);
      console.log(`   Created at: ${user.created_at}`);
    }
    
    await client.end();
    console.log('\n✅ Setup completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Failed to create admin user:');
    console.error(error.message);
    if (client._connected) {
      await client.end();
    }
    process.exit(1);
  }
}

createAdminUser();

