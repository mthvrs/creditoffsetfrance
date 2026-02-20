import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load from backend/.env (one level up from config/)
dotenv.config({ path: path.join(__dirname, '../.env') });

logger.info(`🔍 DATABASE_URL: ${process.env.DATABASE_URL ? '✅ Set' : '❌ Undefined'}`);
logger.info(`🔄 RESET_DB: ${process.env.RESET_DB ? '✅ Enabled' : '❌ Disabled'}`);

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
      logger.info('🔄 RESET_DB is enabled, dropping all tables...');
      await client.query(`
        DROP TABLE IF EXISTS reports CASCADE;
        DROP TABLE IF EXISTS comment_likes CASCADE;
        DROP TABLE IF EXISTS likes CASCADE;
        DROP TABLE IF EXISTS ip_bans CASCADE;
        DROP TABLE IF EXISTS comments CASCADE;
        DROP TABLE IF EXISTS post_credit_scenes CASCADE;
        DROP TABLE IF EXISTS submissions CASCADE;
        DROP TABLE IF EXISTS movies CASCADE;
        DROP TABLE IF EXISTS admin_users CASCADE;
      `);
      logger.info('✅ All tables dropped');
    } else {
      // Check if tables already exist
      const result = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'movies'
      `);

      if (result.rows.length > 0) {
        logger.info('✅ Database tables already exist, skipping init');
        // Attempt to add missing release_date column if needed
        try {
          await client.query(`
            ALTER TABLE movies 
            ADD COLUMN release_date DATE;
          `);
          logger.info('✅ Added missing release_date column');
        } catch (e) {
          // Column likely already exists
        }
        // Ensure unaccent extension exists even when tables already exist
        try {
          await client.query('CREATE EXTENSION IF NOT EXISTS unaccent;');
          logger.info('✅ Unaccent extension verified');
        } catch (e) {
          logger.error('⚠️ Could not create unaccent extension', { error: e.message });
        }
        return;
      }
    }

    // Enable unaccent extension for accent-insensitive search
    logger.info('📦 Enabling unaccent extension...');
    await client.query('CREATE EXTENSION IF NOT EXISTS unaccent;');
    logger.info('✅ Unaccent extension enabled');

    logger.info('📋 Creating database tables...');

    await client.query(`
      CREATE TABLE movies (
        id SERIAL PRIMARY KEY,
        tmdb_id INTEGER UNIQUE NOT NULL,
        title VARCHAR(500) NOT NULL,
        original_title VARCHAR(500),
        release_date DATE,
        cpl_title_date DATE,
        poster_path VARCHAR(500),
        runtime INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE submissions (
        id SERIAL PRIMARY KEY,
        movie_id INTEGER REFERENCES movies(id) ON DELETE CASCADE,
        cpl_title VARCHAR(500) NOT NULL,
        version VARCHAR(200),
        ffec VARCHAR(20) NOT NULL,
        ffmc VARCHAR(20) NOT NULL,
        notes TEXT,
        source VARCHAR(100) NOT NULL,
        source_other VARCHAR(200),
        username VARCHAR(100),
        submitter_ip VARCHAR(45),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE post_credit_scenes (
        id SERIAL PRIMARY KEY,
        submission_id INTEGER REFERENCES submissions(id) ON DELETE CASCADE,
        start_time VARCHAR(20) NOT NULL,
        end_time VARCHAR(20) NOT NULL,
        description TEXT,
        scene_order INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE comments (
        id SERIAL PRIMARY KEY,
        movie_id INTEGER REFERENCES movies(id) ON DELETE CASCADE,
        username VARCHAR(100) NOT NULL,
        comment_text TEXT NOT NULL,
        submitter_ip VARCHAR(45),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE likes (
        id SERIAL PRIMARY KEY,
        submission_id INTEGER REFERENCES submissions(id) ON DELETE CASCADE,
        submitter_ip VARCHAR(45) NOT NULL,
        vote_type VARCHAR(10) NOT NULL CHECK (vote_type IN ('like', 'dislike')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(submission_id, submitter_ip)
      );

      CREATE TABLE comment_likes (
        id SERIAL PRIMARY KEY,
        comment_id INTEGER REFERENCES comments(id) ON DELETE CASCADE,
        submitter_ip VARCHAR(45) NOT NULL,
        vote_type VARCHAR(10) NOT NULL CHECK (vote_type IN ('like', 'dislike')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(comment_id, submitter_ip)
      );

      CREATE TABLE ip_bans (
        id SERIAL PRIMARY KEY,
        ip_address VARCHAR(45) UNIQUE NOT NULL,
        reason TEXT,
        banned_by VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE reports (
        id SERIAL PRIMARY KEY,
        report_type VARCHAR(20) NOT NULL CHECK (report_type IN ('submission', 'comment')),
        entity_id INTEGER NOT NULL,
        reason TEXT NOT NULL,
        email VARCHAR(255),
        submitter_ip VARCHAR(45) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE admin_users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX idx_movies_tmdb_id ON movies(tmdb_id);
      CREATE INDEX idx_movies_release_date ON movies(release_date DESC);
      CREATE INDEX idx_movies_cpl_title_date ON movies(cpl_title_date DESC);
      CREATE INDEX idx_submissions_movie_id ON submissions(movie_id);
      CREATE INDEX idx_post_credit_scenes_submission_id ON post_credit_scenes(submission_id);
      CREATE INDEX idx_comments_movie_id ON comments(movie_id);
      CREATE INDEX idx_likes_submission_id ON likes(submission_id);
      CREATE INDEX idx_likes_ip ON likes(submitter_ip);
      CREATE INDEX idx_comment_likes_comment_id ON comment_likes(comment_id);
      CREATE INDEX idx_comment_likes_ip ON comment_likes(submitter_ip);
      CREATE INDEX idx_reports_entity ON reports(report_type, entity_id);
      CREATE INDEX idx_reports_created_at ON reports(created_at DESC);
      CREATE INDEX idx_reports_email ON reports(email);
    `);
    logger.info('✅ Database initialized successfully');
  } catch (error) {
    logger.error('Database initialization error', { error: error.message, stack: error.stack });
    throw error;
  } finally {
    client.release();
  }
}

export default pool;
