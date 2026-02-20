
import pool from '../config/database.js';

const MOVIE_TMDB_ID = 9999999;
const SUBMISSION_COUNT = 500;
const LIKES_PER_SUBMISSION = 20;

async function setup() {
  console.log('Setup: Creating test data...');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Create movie
    const movieRes = await client.query(`
      INSERT INTO movies (tmdb_id, title, original_title, release_date, poster_path, runtime)
      VALUES ($1, 'Benchmark Movie', 'Benchmark Movie Orig', '2023-01-01', '/path.jpg', 120)
      RETURNING id
    `, [MOVIE_TMDB_ID]);
    const movieId = movieRes.rows[0].id;

    console.log(`Created movie with ID: ${movieId}`);

    // Create submissions in batches
    const submissions = [];
    for (let i = 0; i < SUBMISSION_COUNT; i++) {
        submissions.push([movieId, `Version ${i}`, '1.0', '00:00:10', '00:05:00', 'Notes', 'Benchmark', 'User', '127.0.0.1']);
    }

    // Bulk insert submissions isn't trivial with pg without a helper, but we can do a loop or construct query
    // For simplicity, I'll loop but transaction makes it faster.

    // Actually, let's just do a loop, 500 isn't too many for a local DB in transaction.

    for (let i = 0; i < SUBMISSION_COUNT; i++) {
      const subRes = await client.query(`
        INSERT INTO submissions (movie_id, cpl_title, version, ffec, ffmc, notes, source, username, submitter_ip)
        VALUES ($1, $2, '1.0', '00:00:10', '00:05:00', 'Notes', 'Benchmark', 'User', '127.0.0.1')
        RETURNING id
      `, [movieId, `Version ${i}`]);
      const subId = subRes.rows[0].id;

      // Add post credit scenes
      await client.query(`
        INSERT INTO post_credit_scenes (submission_id, start_time, end_time, description, scene_order)
        VALUES ($1, '00:01:00', '00:02:00', 'Scene 1', 1),
               ($1, '00:03:00', '00:04:00', 'Scene 2', 2)
      `, [subId]);

      // Add likes
      // We'll just add a few manually to avoid too many queries
      if (LIKES_PER_SUBMISSION > 0) {
          // Construct values string
          let values = [];
          for (let j = 0; j < LIKES_PER_SUBMISSION; j++) {
             values.push(`(${subId}, '192.168.${i}.${j}', 'like')`);
          }
          await client.query(`
            INSERT INTO likes (submission_id, submitter_ip, vote_type)
            VALUES ${values.join(',')}
          `);
      }
    }

    await client.query('COMMIT');
    console.log('Setup complete.');
    return movieId;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function cleanup(movieId) {
  if (!movieId) return;
  console.log('Cleanup: Deleting test data...');
  // Cascading deletes should handle everything
  await pool.query('DELETE FROM movies WHERE id = $1', [movieId]);
  console.log('Cleanup complete.');
}

async function runBenchmark(movieId) {
  const userIp = '127.0.0.1';

  const originalQuery = `
    SELECT s.*,
      (SELECT COUNT(*) FROM likes WHERE submission_id = s.id AND vote_type = 'like') as like_count,
      (SELECT COUNT(*) FROM likes WHERE submission_id = s.id AND vote_type = 'dislike') as dislike_count,
      (SELECT vote_type FROM likes WHERE submission_id = s.id AND submitter_ip = $2) as user_vote,
      json_agg(
        json_build_object(
          'id', pcs.id,
          'start_time', pcs.start_time,
          'end_time', pcs.end_time,
          'description', pcs.description,
          'scene_order', pcs.scene_order
        ) ORDER BY pcs.scene_order NULLS LAST
      ) FILTER (WHERE pcs.id IS NOT NULL) as post_credit_scenes
    FROM submissions s
    LEFT JOIN post_credit_scenes pcs ON pcs.submission_id = s.id
    WHERE s.movie_id = $1
    GROUP BY s.id
    ORDER BY s.created_at DESC
  `;

  const optimizedQuery = `
    WITH submission_stats AS (
        SELECT
            submission_id,
            COUNT(*) FILTER (WHERE vote_type = 'like') as like_count,
            COUNT(*) FILTER (WHERE vote_type = 'dislike') as dislike_count,
            MAX(vote_type) FILTER (WHERE submitter_ip = $2) as user_vote
        FROM likes
        WHERE submission_id IN (SELECT id FROM submissions WHERE movie_id = $1)
        GROUP BY submission_id
    )
    SELECT
        s.*,
        COALESCE(ss.like_count, 0) as like_count,
        COALESCE(ss.dislike_count, 0) as dislike_count,
        ss.user_vote,
        json_agg(
          json_build_object(
            'id', pcs.id,
            'start_time', pcs.start_time,
            'end_time', pcs.end_time,
            'description', pcs.description,
            'scene_order', pcs.scene_order
          ) ORDER BY pcs.scene_order NULLS LAST
        ) FILTER (WHERE pcs.id IS NOT NULL) as post_credit_scenes
    FROM submissions s
    LEFT JOIN post_credit_scenes pcs ON pcs.submission_id = s.id
    LEFT JOIN submission_stats ss ON ss.submission_id = s.id
    WHERE s.movie_id = $1
    GROUP BY s.id, ss.like_count, ss.dislike_count, ss.user_vote
    ORDER BY s.created_at DESC
  `;

  console.log('Running Original Query...');
  const startOrig = performance.now();
  for (let i = 0; i < 20; i++) {
    await pool.query(originalQuery, [movieId, userIp]);
  }
  const endOrig = performance.now();
  const avgOrig = (endOrig - startOrig) / 20;
  console.log(`Original Query Average Time: ${avgOrig.toFixed(2)} ms`);

  console.log('Running Optimized Query...');
  const startOpt = performance.now();
  for (let i = 0; i < 20; i++) {
    await pool.query(optimizedQuery, [movieId, userIp]);
  }
  const endOpt = performance.now();
  const avgOpt = (endOpt - startOpt) / 20;
  console.log(`Optimized Query Average Time: ${avgOpt.toFixed(2)} ms`);

  console.log(`Improvement: ${(avgOrig / avgOpt).toFixed(2)}x`);
}

async function main() {
  let movieId;
  try {
    movieId = await setup();
    await runBenchmark(movieId);
    await cleanup(movieId);
  } catch (e) {
    console.error('Error:', e);
    if (movieId) await cleanup(movieId);
  } finally {
    await pool.end();
  }
}

main();
