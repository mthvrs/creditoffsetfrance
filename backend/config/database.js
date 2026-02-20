import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load from backend/.env (one level up from config/)
dotenv.config({ path: path.join(__dirname, '../.env') });

console.log('🔍 DATABASE_URL:', process.env.DATABASE_URL ? '✅ Set' : '❌ Undefined');
console.log('🔄 RESET_DB:', process.env.RESET_DB ? '✅ Enabled' : '❌ Disabled');

import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function initDatabase() {
  const client = await pool.connect();
  try {
    const shouldReset = process.env.RESET_DB === 'true' || process.env.NODE_ENV === 'test';

    if (shouldReset) {
      console.log('🔄 RESET_DB is enabled, dropping all tables...');
      const dropSql = fs.readFileSync(path.join(__dirname, '../migrations/drop.sql'), 'utf-8');
      await client.query(dropSql);
      console.log('✅ All tables dropped');
    } else {
      // Check if tables already exist
      const result = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'movies'
      `);

      if (result.rows.length > 0) {
        console.log('✅ Database tables already exist, skipping init');
        // Attempt to add missing release_date column if needed
        try {
          const migrationSql = fs.readFileSync(path.join(__dirname, '../migrations/001_add_release_date.sql'), 'utf-8');
          await client.query(migrationSql);
          console.log('✅ Added missing release_date column');
        } catch (e) {
          // Column likely already exists
        }
        // Ensure unaccent extension exists even when tables already exist
        try {
          await client.query('CREATE EXTENSION IF NOT EXISTS unaccent;');
          console.log('✅ Unaccent extension verified');
        } catch (e) {
          console.error('⚠️ Could not create unaccent extension:', e.message);
        }
        return;
      }
    }

    // Enable unaccent extension for accent-insensitive search
    console.log('📦 Enabling unaccent extension...');
    await client.query('CREATE EXTENSION IF NOT EXISTS unaccent;');
    console.log('✅ Unaccent extension enabled');

    console.log('📋 Creating database tables...');

    const schemaSql = fs.readFileSync(path.join(__dirname, '../migrations/schema.sql'), 'utf-8');
    await client.query(schemaSql);
    console.log('✅ Database initialized successfully');
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  } finally {
    client.release();
  }
}

export default pool;
