import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { JSDOM } from 'jsdom';
import dotenv from 'dotenv';
import pool from '../config/database.js';
import axios from 'axios';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

// Search for movie on TMDB
async function searchMovie(title, year) {
  if (!TMDB_API_KEY) {
    console.log('⚠️  No TMDB API key, skipping movie lookup');
    return null;
  }

  try {
    const response = await axios.get(`${TMDB_BASE_URL}/search/movie`, {
      params: {
        api_key: TMDB_API_KEY,
        query: title,
        year: year,
        language: 'fr-FR'
      }
    });

    if (response.data.results && response.data.results.length > 0) {
      return response.data.results[0];
    }
  } catch (error) {
    console.log(`❌ Error searching for "${title}":`, error.message);
  }

  return null;
}

// Normalize time format from MM:SS or H:MM:SS to 0:MM:SS or H:MM:SS
function normalizeTime(timeStr) {
  if (!timeStr || !timeStr.includes(':')) return null;

  const parts = timeStr.trim().split(':');
  
  if (parts.length === 2) {
    // MM:SS format -> convert to 0:MM:SS
    return `0:${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
  } else if (parts.length === 3) {
    // H:MM:SS or HH:MM:SS format
    return `${parts[0]}:${parts[1].padStart(2, '0')}:${parts[2].padStart(2, '0')}`;
  }

  return timeStr;
}

// Parse HTML file and extract movie data
function parseHtmlFile(filename) {
  console.log(`📖 Reading file: ${filename}`);
  
  const htmlContent = fs.readFileSync(filename, 'utf-8');
  const dom = new JSDOM(htmlContent);
  const document = dom.window.document;

  const movies = [];
  const rows = document.querySelectorAll('tr');

  let currentMovie = {};

  rows.forEach(row => {
    const cells = row.querySelectorAll('td, th');
    
    if (cells.length === 0) return;

    // Look for title
    const titleCell = row.querySelector('.show-title');
    if (titleCell) {
      currentMovie.title = titleCell.textContent.trim();
    }

    // Look for year
    const yearCell = row.querySelector('.show-year');
    if (yearCell) {
      const yearMatch = yearCell.textContent.match(/\((\d{4})\)/);
      if (yearMatch) {
        currentMovie.year = yearMatch[1];
      }
    }

    // Look for time values (Pre-COS and COS)
    const times = [];
    cells.forEach(cell => {
      const text = cell.textContent.trim();
      // Match time format: MM:SS or H:MM:SS or HH:MM:SS
      if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(text)) {
        times.push(text);
      }
    });

    // If we found times and have a title, process the row
    if (times.length > 0 && currentMovie.title) {
      if (times.length === 1) {
        // Only COS
        currentMovie.cos = times[0];
        currentMovie.pre_cos = null;
      } else if (times.length >= 2) {
        // Both Pre-COS and COS
        currentMovie.pre_cos = times[0];
        currentMovie.cos = times[1];
      }

      // Normalize times
      if (currentMovie.cos) {
        currentMovie.cos = normalizeTime(currentMovie.cos);
      }
      if (currentMovie.pre_cos) {
        currentMovie.pre_cos = normalizeTime(currentMovie.pre_cos);
      }

      // Add to movies list if we have a COS
      if (currentMovie.cos) {
        movies.push({ ...currentMovie });
      }

      // Reset for next movie
      currentMovie = {};
    }
  });

  return movies;
}

// Insert or get movie from database
async function upsertMovie(client, movieData) {
  try {
    // Check if movie exists by title and year
    const existingMovie = await client.query(
      'SELECT id, tmdb_id FROM movies WHERE title = $1 AND EXTRACT(YEAR FROM release_date) = $2',
      [movieData.title, movieData.year]
    );

    if (existingMovie.rows.length > 0) {
      return existingMovie.rows[0].id;
    }

    // Search TMDB for movie data
    const tmdbData = await searchMovie(movieData.title, movieData.year);
    
    const insertQuery = `
      INSERT INTO movies (tmdb_id, title, original_title, release_date, poster_path, runtime)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `;

    const values = [
      tmdbData?.id || Math.floor(Math.random() * 1000000) + 1000000, // Use random ID if no TMDB data
      movieData.title,
      tmdbData?.original_title || movieData.title,
      tmdbData?.release_date || `${movieData.year}-01-01`,
      tmdbData?.poster_path || null,
      tmdbData?.runtime || null
    ];

    const result = await client.query(insertQuery, values);
    return result.rows[0].id;

  } catch (error) {
    console.error(`Error upserting movie "${movieData.title}":`, error.message);
    throw error;
  }
}

// Insert submission data
async function insertSubmission(client, movieId, movieData) {
  const submissionQuery = `
    INSERT INTO submissions (movie_id, cpl_title, version, ffec, ffmc, notes, source, username, created_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING id
  `;

  const ffec = movieData.pre_cos ? movieData.pre_cos : movieData.cos;
  const ffmc = movieData.cos;

  const values = [
    movieId,
    movieData.title,
    'Legacy Import',
    ffec,
    ffmc,
    'Imported from historical data (17 Feb 2026)',
    'historical',
    'system',
    new Date()
  ];

  const result = await client.query(submissionQuery, values);
  return result.rows[0].id;
}

// Insert post-credit scene if exists
async function insertPostCreditScene(client, submissionId, movieData) {
  if (!movieData.pre_cos) return;

  const sceneQuery = `
    INSERT INTO post_credit_scenes (submission_id, start_time, end_time, description, scene_order)
    VALUES ($1, $2, $3, $4, $5)
  `;

  await client.query(sceneQuery, [
    submissionId,
    movieData.pre_cos,
    movieData.cos,
    'Pre-credit scene (imported from historical data)',
    1
  ]);
}

// Main function
async function main() {
  const inputFile = path.join(__dirname, '../../historicaldata_17Fev2026.html');
  
  if (!fs.existsSync(inputFile)) {
    console.error(`❌ File not found: ${inputFile}`);
    console.log('Please make sure "historicaldata_17Fev2026.html" exists in the project root directory.');
    process.exit(1);
  }

  console.log('🚀 Starting historical data import...\n');

  // Parse the HTML file
  const movies = parseHtmlFile(inputFile);
  console.log(`✅ Parsed ${movies.length} movies from HTML\n`);

  // Show sample
  console.log('📋 Sample (first 3 movies):');
  movies.slice(0, 3).forEach(movie => {
    console.log(`  - ${movie.title} (${movie.year || 'N/A'})`);
    console.log(`    Pre-COS: ${movie.pre_cos || 'N/A'}, COS: ${movie.cos || 'N/A'}`);
  });
  console.log('');

  // Connect to database
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    let successCount = 0;
    let errorCount = 0;

    console.log('💾 Importing to database...\n');

    for (const [index, movieData] of movies.entries()) {
      try {
        // Progress indicator
        if ((index + 1) % 10 === 0) {
          console.log(`⏳ Processed ${index + 1}/${movies.length} movies...`);
        }

        // Insert movie
        const movieId = await upsertMovie(client, movieData);

        // Insert submission
        const submissionId = await insertSubmission(client, movieId, movieData);

        // Insert post-credit scene if exists
        if (movieData.pre_cos) {
          await insertPostCreditScene(client, submissionId, movieData);
        }

        successCount++;

        // Small delay to avoid rate limiting TMDB API
        if (TMDB_API_KEY && index % 5 === 0) {
          await new Promise(resolve => setTimeout(resolve, 250));
        }

      } catch (error) {
        errorCount++;
        console.error(`❌ Failed to import "${movieData.title}": ${error.message}`);
      }
    }

    await client.query('COMMIT');

    console.log('\n✅ Import complete!');
    console.log(`   Success: ${successCount}`);
    console.log(`   Errors: ${errorCount}`);
    console.log(`   Total: ${movies.length}`);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Transaction failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the script
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
