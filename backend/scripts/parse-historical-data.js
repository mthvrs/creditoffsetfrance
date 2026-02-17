import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { JSDOM } from 'jsdom';
import dotenv from 'dotenv';
import pool from '../config/database.js';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

// Search for movie on TMDB
async function searchMovie(title, year) {
  if (!TMDB_API_KEY) {
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
    // Silent fail for TMDB lookups
  }

  return null;
}

// Normalize time format from MM:SS to 0:MM:SS
function normalizeTime(timeStr) {
  if (!timeStr || !timeStr.trim()) return null;
  
  const cleaned = timeStr.trim();
  if (!cleaned.includes(':')) return null;

  const parts = cleaned.split(':');
  
  if (parts.length === 2) {
    // MM:SS format -> convert to 0:MM:SS
    return `0:${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
  } else if (parts.length === 3) {
    // Already H:MM:SS or HH:MM:SS format
    return `${parts[0]}:${parts[1].padStart(2, '0')}:${parts[2].padStart(2, '0')}`;
  }

  return cleaned;
}

// Parse HTML file and extract movie data
function parseHtmlFile(filename) {
  console.log(`📖 Reading file: ${filename}`);
  
  const htmlContent = fs.readFileSync(filename, 'utf-8');
  const dom = new JSDOM(htmlContent);
  const document = dom.window.document;

  const movies = [];
  const rows = document.querySelectorAll('tbody tr');

  console.log(`Found ${rows.length} rows in table`);

  rows.forEach((row, index) => {
    try {
      const titleElem = row.querySelector('.show-title');
      const yearElem = row.querySelector('.show-year');
      
      if (!titleElem) return;

      const title = titleElem.textContent.trim();
      
      // Extract year from (YYYY) format
      let year = null;
      if (yearElem) {
        const yearMatch = yearElem.textContent.match(/\((\d{4})\)/);
        if (yearMatch) {
          year = yearMatch[1];
        }
      }

      // Get all td elements
      const cells = row.querySelectorAll('td');
      
      // First td is title, second is Pré-COS, third is COS
      let preCos = null;
      let cos = null;

      if (cells.length >= 3) {
        const preCosTxt = cells[1].textContent.trim();
        const cosTxt = cells[2].textContent.trim();
        
        preCos = normalizeTime(preCosTxt);
        cos = normalizeTime(cosTxt);
      }

      // Only add if we have at least a COS time
      if (cos) {
        movies.push({
          title,
          year,
          pre_cos: preCos,
          cos
        });
      }
    } catch (error) {
      console.error(`Error parsing row ${index + 1}:`, error.message);
    }
  });

  return movies;
}

// Insert or get movie from database
async function upsertMovie(client, movieData) {
  try {
    // Try to find existing movie by title
    let query = 'SELECT id, tmdb_id FROM movies WHERE LOWER(title) = LOWER($1)';
    let params = [movieData.title];
    
    if (movieData.year) {
      query += ' AND EXTRACT(YEAR FROM release_date) = $2';
      params.push(movieData.year);
    }

    const existingMovie = await client.query(query, params);

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

    // Generate unique TMDB ID if no data found
    const tmdbId = tmdbData?.id || (Math.floor(Math.random() * 9000000) + 9000000);
    const releaseDate = tmdbData?.release_date || (movieData.year ? `${movieData.year}-01-01` : '2025-01-01');

    const values = [
      tmdbId,
      movieData.title,
      tmdbData?.original_title || movieData.title,
      releaseDate,
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

  // FFEC is the start time (either pre-COS or COS)
  // FFMC is the end time (always COS)
  const ffec = movieData.pre_cos || movieData.cos;
  const ffmc = movieData.cos;

  const values = [
    movieId,
    movieData.title,
    'Historique',
    ffec,
    ffmc,
    'Données historiques importées le 17 février 2026',
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
    'Scène pré-générique',
    1
  ]);
}

// Main function
async function main() {
  const inputFile = path.join(__dirname, '../../historicaldata_17Fev2026.html');
  
  if (!fs.existsSync(inputFile)) {
    console.error(`❌ File not found: ${inputFile}`);
    console.log('Please make sure "historicaldata_17Fev2026.html" exists in the project root directory.');
    console.log(`Expected location: ${inputFile}`);
    process.exit(1);
  }

  console.log('🚀 Starting historical data import...\n');

  // Parse the HTML file
  const movies = parseHtmlFile(inputFile);
  console.log(`✅ Parsed ${movies.length} movies from HTML\n`);

  if (movies.length === 0) {
    console.error('❌ No movies found in HTML file. Please check the file format.');
    process.exit(1);
  }

  // Show sample
  console.log('📋 Sample (first 5 movies):');
  movies.slice(0, 5).forEach(movie => {
    console.log(`  - ${movie.title} (${movie.year || 'N/A'})`);
    console.log(`    Pré-COS: ${movie.pre_cos || 'N/A'}, COS: ${movie.cos || 'N/A'}`);
  });
  console.log('');

  // Connect to database
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    console.log('💾 Importing to database...\n');

    for (const [index, movieData] of movies.entries()) {
      try {
        // Progress indicator
        if ((index + 1) % 25 === 0) {
          console.log(`⏳ Processed ${index + 1}/${movies.length} movies...`);
        }

        // Insert movie
        const movieId = await upsertMovie(client, movieData);

        // Check if submission already exists for this movie
        const existingSubmission = await client.query(
          'SELECT id FROM submissions WHERE movie_id = $1 AND source = $2',
          [movieId, 'historical']
        );

        if (existingSubmission.rows.length > 0) {
          skippedCount++;
          continue;
        }

        // Insert submission
        const submissionId = await insertSubmission(client, movieId, movieData);

        // Insert post-credit scene if exists
        if (movieData.pre_cos) {
          await insertPostCreditScene(client, submissionId, movieData);
        }

        successCount++;

        // Small delay to avoid rate limiting TMDB API
        if (TMDB_API_KEY && index % 10 === 0 && index > 0) {
          await new Promise(resolve => setTimeout(resolve, 250));
        }

      } catch (error) {
        errorCount++;
        console.error(`❌ Failed to import "${movieData.title}": ${error.message}`);
      }
    }

    await client.query('COMMIT');

    console.log('\n✅ Import complete!');
    console.log(`   Imported: ${successCount}`);
    console.log(`   Skipped (already exists): ${skippedCount}`);
    console.log(`   Errors: ${errorCount}`);
    console.log(`   Total processed: ${movies.length}`);

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
