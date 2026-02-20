/**
 * Benchmark Script for Reports Query
 *
 * Usage:
 * 1. Ensure you have a PostgreSQL database running.
 * 2. Create a .env file in the backend directory with DATABASE_URL and RESET_DB=true.
 * 3. Run: node benchmark.js
 */

import pool from './config/database.js';

// Helper to wait
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function seed() {
  console.log('🧹 Clearing tables...');
  await pool.query('TRUNCATE reports, comments, submissions, movies CASCADE');

  const movieCount = 1000;
  const submissionCount = 5000;
  const commentCount = 5000;
  const reportCount = 10000;

  console.log(`🎬 Seeding ${movieCount} movies...`);
  const movies = [];
  for(let i=0; i<movieCount; i++) {
     movies.push([
        i + 100000, // tmdb_id
        `Movie Title ${i}`,
        `Original Title ${i}`,
        '2023-01-01',
        '/poster.jpg',
        120
     ]);
  }

  const insertMovies = async (batch) => {
    const values = [];
    const placeholders = batch.map((m, i) => `($${i*6+1}, $${i*6+2}, $${i*6+3}, $${i*6+4}, $${i*6+5}, $${i*6+6})`).join(',');
    batch.forEach(m => values.push(...m));
    await pool.query(`INSERT INTO movies (tmdb_id, title, original_title, release_date, poster_path, runtime) VALUES ${placeholders}`, values);
  };

  for (let i=0; i<movies.length; i+=500) {
      await insertMovies(movies.slice(i, i+500));
  }

  // Get all movie IDs
  const movieIdsRes = await pool.query('SELECT id FROM movies');
  const movieIds = movieIdsRes.rows.map(r => r.id);

  console.log(`📝 Seeding ${submissionCount} submissions...`);
  const submissions = [];
  for(let i=0; i<submissionCount; i++) {
      submissions.push([
          movieIds[Math.floor(Math.random() * movieIds.length)],
          'Version 1',
          '00:00:00',
          '00:00:00',
          'Notes',
          'Source',
          '127.0.0.1',
          'user1'
      ]);
  }

  const insertSubmissions = async (batch) => {
      const values = [];
      const placeholders = batch.map((s, i) => `($${i*8+1}, $${i*8+2}, $${i*8+3}, $${i*8+4}, $${i*8+5}, $${i*8+6}, $${i*8+7}, $${i*8+8})`).join(',');
      batch.forEach(s => values.push(...s));
      await pool.query(`INSERT INTO submissions (movie_id, cpl_title, ffec, ffmc, notes, source, submitter_ip, username) VALUES ${placeholders}`, values);
  }

  for (let i=0; i<submissions.length; i+=500) {
      await insertSubmissions(submissions.slice(i, i+500));
  }

  // Get submission IDs
  const submissionIdsRes = await pool.query('SELECT id FROM submissions');
  const submissionIds = submissionIdsRes.rows.map(r => r.id);

  console.log(`💬 Seeding ${commentCount} comments...`);
  const comments = [];
  for(let i=0; i<commentCount; i++) {
      comments.push([
          movieIds[Math.floor(Math.random() * movieIds.length)],
          'user2',
          'Comment text',
          '127.0.0.1'
      ]);
  }

  const insertComments = async (batch) => {
      const values = [];
      const placeholders = batch.map((c, i) => `($${i*4+1}, $${i*4+2}, $${i*4+3}, $${i*4+4})`).join(',');
      batch.forEach(c => values.push(...c));
      await pool.query(`INSERT INTO comments (movie_id, username, comment_text, submitter_ip) VALUES ${placeholders}`, values);
  }

  for (let i=0; i<comments.length; i+=500) {
      await insertComments(comments.slice(i, i+500));
  }

  // Get comment IDs
  const commentIdsRes = await pool.query('SELECT id FROM comments');
  const commentIds = commentIdsRes.rows.map(r => r.id);

  console.log(`🚩 Seeding ${reportCount} reports...`);
  const reports = [];
  for(let i=0; i<reportCount; i++) {
      const isSubmission = Math.random() > 0.5;
      const type = isSubmission ? 'submission' : 'comment';
      const entityId = isSubmission
          ? submissionIds[Math.floor(Math.random() * submissionIds.length)]
          : commentIds[Math.floor(Math.random() * commentIds.length)];

      reports.push([
          type,
          entityId,
          'Reason',
          'email@example.com',
          '127.0.0.1'
      ]);
  }

  const insertReports = async (batch) => {
      const values = [];
      const placeholders = batch.map((r, i) => `($${i*5+1}, $${i*5+2}, $${i*5+3}, $${i*5+4}, $${i*5+5})`).join(',');
      batch.forEach(r => values.push(...r));
      await pool.query(`INSERT INTO reports (report_type, entity_id, reason, email, submitter_ip) VALUES ${placeholders}`, values);
  }

  for (let i=0; i<reports.length; i+=500) {
      await insertReports(reports.slice(i, i+500));
  }

  console.log('✅ Seeding complete.');
}

async function runQuery(name, sql, params) {
    const iterations = 20;
    let totalTime = 0n;
    console.log(`\n🏃 Running ${name}...`);

    // Warmup
    await pool.query(sql, params);

    for(let i=0; i<iterations; i++) {
        const start = process.hrtime.bigint();
        await pool.query(sql, params);
        const end = process.hrtime.bigint();
        totalTime += (end - start);
    }

    const avgTime = Number(totalTime / BigInt(iterations)) / 1000000;
    console.log(`   Average Execution time: ${avgTime.toFixed(2)} ms`);
    return avgTime;
}

async function benchmark() {
  const limit = 50;
  const offset = 0;

  console.log('🚀 Starting benchmark...');

  const oldQuery = `
      SELECT
        r.*,
        CASE
          WHEN r.report_type = 'submission' THEN (
            SELECT json_build_object(
              'title', m.title,
              'cpl_title', s.cpl_title,
              'submitter_ip', s.submitter_ip
            )
            FROM submissions s
            JOIN movies m ON s.movie_id = m.id
            WHERE s.id = r.entity_id
          )
          WHEN r.report_type = 'comment' THEN (
            SELECT json_build_object(
              'title', m.title,
              'username', c.username,
              'comment_text', c.comment_text,
              'submitter_ip', c.submitter_ip
            )
            FROM comments c
            JOIN movies m ON c.movie_id = m.id
            WHERE c.id = r.entity_id
          )
        END as entity_data
      FROM reports r
      ORDER BY r.created_at DESC
      LIMIT $1 OFFSET $2
  `;

  const newQuery = `
      SELECT
        r.*,
        CASE
          WHEN r.report_type = 'submission' THEN
            CASE WHEN s.id IS NOT NULL THEN
              json_build_object(
                'title', ms.title,
                'cpl_title', s.cpl_title,
                'submitter_ip', s.submitter_ip
              )
            ELSE NULL END
          WHEN r.report_type = 'comment' THEN
            CASE WHEN c.id IS NOT NULL THEN
              json_build_object(
                'title', mc.title,
                'username', c.username,
                'comment_text', c.comment_text,
                'submitter_ip', c.submitter_ip
              )
            ELSE NULL END
        END as entity_data
      FROM reports r
      LEFT JOIN submissions s ON r.report_type = 'submission' AND s.id = r.entity_id
      LEFT JOIN movies ms ON s.movie_id = ms.id
      LEFT JOIN comments c ON r.report_type = 'comment' AND c.id = r.entity_id
      LEFT JOIN movies mc ON c.movie_id = mc.id
      ORDER BY r.created_at DESC
      LIMIT $1 OFFSET $2
  `;

  const oldTime = await runQuery('Original Query', oldQuery, [limit, offset]);
  const newTime = await runQuery('Optimized Query', newQuery, [limit, offset]);

  console.log(`\n✨ Improvement: ${((oldTime - newTime) / oldTime * 100).toFixed(2)}% faster`);
}

async function main() {
  try {
      await seed();
      await benchmark();
  } catch (err) {
      console.error('⚠️  Benchmark failed (likely due to missing DB connection):');
      console.error(err.message);
      console.log('⚠️  Skipping benchmark execution.');
  } finally {
      await pool.end();
  }
}

main();
