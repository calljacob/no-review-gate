import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
const sqlFile = join(__dirname, '..', 'netlify', 'functions', 'setup-db.sql');
const sqlContent = readFileSync(sqlFile, 'utf-8');

// Split SQL into individual statements (split on semicolons, but preserve string literals)
function parseSQL(sql) {
  const statements = [];
  let currentStatement = '';
  let inString = false;
  let stringChar = null;
  let escapeNext = false;

  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];
    const nextChar = sql[i + 1];

    if (escapeNext) {
      currentStatement += char;
      escapeNext = false;
      continue;
    }

    if (char === '\\' && inString) {
      escapeNext = true;
      currentStatement += char;
      continue;
    }

    if (!inString && (char === "'" || char === '"')) {
      inString = true;
      stringChar = char;
      currentStatement += char;
    } else if (inString && char === stringChar) {
      inString = false;
      stringChar = null;
      currentStatement += char;
    } else if (!inString && char === ';') {
      const trimmed = currentStatement.trim();
      if (trimmed) {
        statements.push(trimmed);
      }
      currentStatement = '';
    } else {
      currentStatement += char;
    }
  }

  // Add final statement if it doesn't end with semicolon
  const trimmed = currentStatement.trim();
  if (trimmed) {
    statements.push(trimmed);
  }

  return statements;
}

async function setupDatabase() {
  try {
    console.log('🚀 Connecting to Neon database...');
    await client.connect();
    console.log('✅ Connected to database\n');
    
    const statements = parseSQL(sqlContent);
    console.log(`📝 Found ${statements.length} SQL statements to execute\n`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      const statementPreview = statement.substring(0, 60).replace(/\n/g, ' ').trim() + '...';
      
      try {
        console.log(`[${i + 1}/${statements.length}] Executing: ${statementPreview}`);
        await client.query(statement);
        console.log(`✅ Statement ${i + 1} executed successfully\n`);
      } catch (error) {
        // Some statements like "CREATE OR REPLACE VIEW" or "IF NOT EXISTS" might error if already exists
        if (error.message.includes('already exists') || error.message.includes('does not exist')) {
          console.log(`⚠️  Statement ${i + 1} skipped (${error.message.split('\n')[0]})\n`);
        } else {
          console.error(`❌ Error executing statement ${i + 1}:`, error.message);
          throw error;
        }
      }
    }

    console.log('✅ Database setup completed successfully!');
    console.log('\nTables created:');
    console.log('  - campaigns');
    console.log('  - reviews');
    console.log('\nIndexes created:');
    console.log('  - idx_reviews_campaign_id');
    console.log('  - idx_reviews_lead_id');
    console.log('  - idx_reviews_created_at');
    console.log('\nViews created:');
    console.log('  - campaign_stats');
    
    await client.end();
    
  } catch (error) {
    console.error('\n❌ Database setup failed:');
    console.error(error.message);
    if (client._connected) {
      await client.end();
    }
    process.exit(1);
  }
}

setupDatabase();

