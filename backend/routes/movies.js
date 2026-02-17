import express from 'express';
import pool from '../config/database.js';
import { validateSubmission, checkValidation, validateComment, validateReport, sanitizeCommentData, sanitizeReportData } from '../middleware/validation.js';
import { submitLimiter, likeLimiter } from '../middleware/rateLimiter.js';
import { checkIpBan } from '../middleware/ipBan.js';
import { sendDiscordWebhook } from '../utils/discord.js';
import logger from '../utils/logger.js';
import { sanitizeText, sanitizeUsername, sanitizePostCreditScenes } from '../utils/sanitizer.js';

const router = express.Router();

/**
 * GET / - Get all movies with pagination
 */
router.get('/', async (req, res) => {
  try {
    // Validate and sanitize page parameter
    let page = parseInt(req.query.page) || 1;
    if (page < 1 || isNaN(page) || !isFinite(page)) {
      page = 1; // Default to page 1 for invalid values
    }
    
    const limit = 20;
    const offset = (page - 1) * limit;

    // Get total count
    const countResult = await pool.query(`SELECT COUNT(*) FROM movies`);
    const totalMovies = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalMovies / limit);

    // Get paginated movies
const result = await pool.query(`
  SELECT 
    m.id, 
    m.title, 
    m.tmdb_id, 
    m.release_date, 
    m.poster_path, 
    m.runtime,
    json_agg(json_build_object(
      'id', s.id, 
      'cpl_title', s.cpl_title, 
      'ffec', s.ffec, 
      'ffmc', s.ffmc, 
      'created_at', s.created_at,
      'post_credit_scenes', (
        SELECT json_agg(json_build_object(
          'id', pcs.id,
          'start_time', pcs.start_time,
          'end_time', pcs.end_time,
          'description', pcs.description,
          'scene_order', pcs.scene_order
        ) ORDER BY pcs.scene_order)
        FROM post_credit_scenes pcs 
        WHERE pcs.submission_id = s.id
      )
    ) ORDER BY s.created_at DESC) FILTER (WHERE s.id IS NOT NULL)
    as submissions,
    (SELECT COUNT(*) FROM comments WHERE movie_id = m.id) as comment_count,
    (SELECT MAX(s2.created_at) FROM submissions s2 WHERE s2.movie_id = m.id) as last_update
  FROM movies m 
  LEFT JOIN submissions s ON m.id = s.movie_id
  GROUP BY m.id 
  ORDER BY last_update DESC NULLS LAST, m.created_at DESC 
  LIMIT $1 OFFSET $2
`, [limit, offset]);

    res.json({
      movies: result.rows,
      pagination: {
        currentPage: page,
        totalPages,
        totalMovies,
        moviesPerPage: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });
  } catch (error) {
    logger.error('Get movies error', { error: error.message, stack: error.stack, ip: req.ip });
    console.error('Get movies error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération' });
  }
});

/**
 * GET /search - Search movies with accent-insensitive matching
 */
router.get('/search', async (req, res) => {
  const { query } = req.query;

  if (!query || query.length < 2) {
    return res.status(400).json({ error: 'Requête trop courte' });
  }

  try {
    // Use unaccent for accent-insensitive search
    // Priority: exact matches > word start matches > substring matches
    const result = await pool.query(
      `SELECT 
        m.id, m.tmdb_id, m.title, m.original_title, m.release_date, m.poster_path, m.runtime,
        COUNT(s.id) as submission_count,
        -- Prioritize exact matches, then word starts, then substrings
        CASE
          WHEN unaccent(LOWER(m.title)) = unaccent(LOWER($1)) THEN 1
          WHEN unaccent(LOWER(m.original_title)) = unaccent(LOWER($1)) THEN 1
          WHEN unaccent(LOWER(m.title)) LIKE unaccent(LOWER($1)) || '%' THEN 2
          WHEN unaccent(LOWER(m.original_title)) LIKE unaccent(LOWER($1)) || '%' THEN 2
          ELSE 3
        END as match_priority
      FROM movies m
      LEFT JOIN submissions s ON m.id = s.movie_id 
      WHERE unaccent(LOWER(m.title)) LIKE '%' || unaccent(LOWER($1)) || '%'
         OR unaccent(LOWER(m.original_title)) LIKE '%' || unaccent(LOWER($1)) || '%'
      GROUP BY m.id
      ORDER BY match_priority ASC, submission_count DESC, m.release_date DESC
      LIMIT 20`,
      [query]
    );

    res.json(result.rows);
  } catch (error) {
    logger.error('Search movies error', { error: error.message, stack: error.stack, ip: req.ip });
    console.error('Search movies error:', error);
    res.status(500).json({ error: 'Erreur lors de la recherche' });
  }
});

/**
 * GET /check/:tmdb_id - Check if movie exists
 */
router.get('/check/:tmdb_id', async (req, res) => {
  const { tmdb_id } = req.params;

  try {
    const result = await pool.query(
      `SELECT m.*, COUNT(s.id) as submissioncount
      FROM movies m
      LEFT JOIN submissions s ON m.id = s.movie_id
      WHERE m.tmdb_id = $1
      GROUP BY m.id`,
      [tmdb_id]
    );

    if (result.rows.length > 0) {
      res.json({ exists: true, movie: result.rows[0] });
    } else {
      res.json({ exists: false });
    }
  } catch (error) {
    logger.error('Check movies error', { error: error.message, stack: error.stack, ip: req.ip });
    console.error('Check movie error:', error);
    res.status(500).json({ error: 'Erreur lors de la vérification' });
  }
});

/**
 * POST / - Submit a new movie with sanitization
 */
router.post('/', checkIpBan, submitLimiter, validateSubmission, checkValidation, async (req, res) => {
  let {
    tmdb_id,
    title,
    original_title,
    release_date,
    poster_path,
    runtime,
    cpl_title,
    version,
    ffec,
    ffmc,
    notes,
    source,
    source_other,
    username,
    post_credit_scenes
  } = req.body;

  const submitter_ip = req.ip;

  // IMPORTANT: Do NOT sanitize title and original_title - they come from TMDB (trusted source)
  // Sanitize only user-submitted content to prevent XSS
  cpl_title = sanitizeText(cpl_title);
  version = version ? sanitizeText(version) : null;
  notes = notes ? sanitizeText(notes) : null;
  source_other = source_other ? sanitizeText(source_other) : null;
  username = username ? sanitizeUsername(username) : null;
  post_credit_scenes = post_credit_scenes ? sanitizePostCreditScenes(post_credit_scenes) : [];

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Insert or update movie
    const movieResult = await client.query(
      `INSERT INTO movies (tmdb_id, title, original_title, release_date, poster_path, runtime)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (tmdb_id) DO UPDATE SET
        title = EXCLUDED.title,
        original_title = EXCLUDED.original_title,
        release_date = EXCLUDED.release_date,
        poster_path = EXCLUDED.poster_path,
        runtime = EXCLUDED.runtime
      RETURNING id`,
      [tmdb_id, title, original_title, release_date || null, poster_path, runtime || null]
    );

    const movie_id = movieResult.rows[0].id;

    // Insert submission
    const submissionResult = await client.query(
      `INSERT INTO submissions (movie_id, cpl_title, version, ffec, ffmc, notes, source, source_other, username, submitter_ip)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [movie_id, cpl_title, version, ffec, ffmc, notes, source, source_other, username, submitter_ip]
    );

    const submission_id = submissionResult.rows[0].id;

    // Insert post-credit scenes
    if (post_credit_scenes && post_credit_scenes.length > 0) {
      for (let i = 0; i < post_credit_scenes.length; i++) {
        const scene = post_credit_scenes[i];
        await client.query(
          `INSERT INTO post_credit_scenes (submission_id, start_time, end_time, description, scene_order)
          VALUES ($1, $2, $3, $4, $5)`,
          [submission_id, scene.start_time, scene.end_time, scene.description || null, i + 1]
        );
      }
    }

    await client.query('COMMIT');

    // Discord webhook
    const embedFields = [
      { name: 'Film', value: title, inline: false }
    ];

    if (cpl_title) {
      embedFields.push({ name: 'CPL/Version', value: cpl_title, inline: false });
    }

    if (ffec) {
      embedFields.push({ name: 'FFEC', value: ffec, inline: true });
    }

    if (ffmc) {
      embedFields.push({ name: 'FFMC', value: ffmc, inline: true });
    }

    if (notes) {
      embedFields.push({ name: 'Notes', value: notes.substring(0, 500), inline: false });
    }

    embedFields.push({
      name: 'Source',
      value: source === 'Autre' ? source_other : source,
      inline: false
    });

    if (username) {
      embedFields.push({ name: 'Par', value: username, inline: true });
    }

    embedFields.push({ name: 'IP', value: submitter_ip, inline: true });

    if (post_credit_scenes && post_credit_scenes.length > 0) {
      const scenesText = post_credit_scenes.map((s, i) => 
        `Scène ${i + 1}: ${s.start_time} → ${s.end_time}${s.description ? ` - ${s.description}` : ''}`
      ).join('\n');
      embedFields.push({ name: 'Scènes Post-Générique', value: scenesText, inline: false });
    }

    await sendDiscordWebhook('submissions', {
      title: 'Nouvelle Soumission',
      color: 5814783,
      fields: embedFields,
      timestamp: new Date().toISOString()
    });

    res.status(201).json({
      message: 'Soumission réussie',
      submission: submissionResult.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Submit error:', error);
    logger.error('Movie submission error', { error: error.message, stack: error.stack, ip: req.ip });
    res.status(500).json({ error: 'Erreur lors de la soumission' });
  } finally {
    client.release();
  }
});

/**
 * POST /submissions/:id/report - Report a submission with sanitization
 * IMPORTANT: This route must come BEFORE the voting route to avoid route conflicts
 */
router.post('/submissions/:id/report', checkIpBan, submitLimiter, validateReport, sanitizeReportData, async (req, res) => {
  const { id } = req.params;
  let { reason, email } = req.body;
  const submitter_ip = req.ip;

  // Additional sanitization
  reason = sanitizeText(reason);

  try {
    const result = await pool.query(
      `SELECT s.*, m.title, m.tmdb_id
      FROM submissions s 
      JOIN movies m ON s.movie_id = m.id 
      WHERE s.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Soumission non trouvée' });
    }

    const submission = result.rows[0];

    // Store report in database
    await pool.query(
      `INSERT INTO reports (report_type, entity_id, reason, email, submitter_ip)
      VALUES ($1, $2, $3, $4, $5)`,
      ['submission', id, reason, email || null, submitter_ip]
    );

    // Send Discord webhook
    const fields = [
      { name: 'Film', value: submission.title, inline: false },
      { name: 'CPL/Version', value: submission.cpl_title, inline: false },
      { name: 'Raison', value: reason.substring(0, 500), inline: false },
      { name: 'ID Soumission', value: id, inline: true },
      { name: 'IP', value: submitter_ip, inline: true }
    ];

    if (email) {
      fields.push({ name: 'Email', value: email, inline: true });
    }

    await sendDiscordWebhook('reports', {
      title: '🚨 Signalement - Version',
      color: 16744448,
      fields,
      timestamp: new Date().toISOString()
    });

    res.json({ message: 'Signalement envoyé avec succès' });
  } catch (error) {
    logger.error('Report submission error', { error: error.message, stack: error.stack, ip: req.ip });
    console.error('Report submission error:', error);
    res.status(500).json({ error: 'Erreur lors du signalement' });
  }
});

/**
 * POST /submissions/:id/:vote_type - Vote on submission (like/dislike)
 * Includes auto-reporting at dislike thresholds
 * IMPORTANT: This route must come AFTER the report route to avoid conflicts
 */
router.post('/submissions/:id/:vote_type', checkIpBan, likeLimiter, async (req, res) => {
  const { id, vote_type } = req.params;
  const submitter_ip = req.ip;

  if (!['like', 'dislike'].includes(vote_type)) {
    return res.status(400).json({ error: 'Type de vote invalide' });
  }

  try {
    const existingVote = await pool.query(
      `SELECT * FROM likes WHERE submission_id = $1 AND submitter_ip = $2`,
      [id, submitter_ip]
    );

    if (existingVote.rows.length > 0) {
      const currentVote = existingVote.rows[0].vote_type;

      if (currentVote === vote_type) {
        // Remove vote if clicking same button
        await pool.query(
          `DELETE FROM likes WHERE submission_id = $1 AND submitter_ip = $2`,
          [id, submitter_ip]
        );
      } else {
        // Change vote type
        await pool.query(
          `UPDATE likes SET vote_type = $1 WHERE submission_id = $2 AND submitter_ip = $3`,
          [vote_type, id, submitter_ip]
        );
      }
    } else {
      // New vote
      await pool.query(
        `INSERT INTO likes (submission_id, submitter_ip, vote_type) VALUES ($1, $2, $3)`,
        [id, submitter_ip, vote_type]
      );
    }

    // Get counts
    const like_count = await pool.query(
      `SELECT COUNT(*) FROM likes WHERE submission_id = $1 AND vote_type = $2`,
      [id, 'like']
    );
    const dislike_count = await pool.query(
      `SELECT COUNT(*) FROM likes WHERE submission_id = $1 AND vote_type = $2`,
      [id, 'dislike']
    );

    const dislikeNum = parseInt(dislike_count.rows[0].count);

    // AUTO-REPORT: Send Discord webhook when hitting dislike thresholds (3, 5, 10)
    if (vote_type === 'dislike' && [3, 5, 10].includes(dislikeNum)) {
      const submission = await pool.query(
        `SELECT s.cpl_title, m.title, m.tmdb_id
        FROM submissions s 
        JOIN movies m ON s.movie_id = m.id 
        WHERE s.id = $1`,
        [id]
      );

      if (submission.rows.length > 0) {
        await sendDiscordWebhook('reports', {
          title: `⚠️ ${dislikeNum} dislikes atteints`,
          color: 15158332,
          fields: [
            { name: 'Film', value: submission.rows[0].title, inline: false },
            { name: 'Version', value: submission.rows[0].cpl_title, inline: false },
            { name: 'Dislikes', value: dislikeNum.toString(), inline: true },
            { name: 'ID', value: id, inline: true }
          ],
          timestamp: new Date().toISOString()
        });
      }
    }

    // Get user's current vote
    const user_vote = await pool.query(
      `SELECT vote_type FROM likes WHERE submission_id = $1 AND submitter_ip = $2`,
      [id, submitter_ip]
    );

    // Get submission details for webhook
    const submission = await pool.query(
      `SELECT s.cpl_title, m.title 
      FROM submissions s 
      JOIN movies m ON s.movie_id = m.id 
      WHERE s.id = $1`,
      [id]
    );

    if (submission.rows.length > 0) {
      await sendDiscordWebhook('likes', {
        title: vote_type === 'like' ? '👍 Like' : '👎 Dislike',
        color: vote_type === 'like' ? 3066993 : 15158332,
        fields: [
          { name: 'Film', value: submission.rows[0].title, inline: false },
          { name: 'Version', value: submission.rows[0].cpl_title, inline: false },
          { name: 'Likes', value: like_count.rows[0].count, inline: true },
          { name: 'Dislikes', value: dislike_count.rows[0].count, inline: true }
        ],
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      like_count: parseInt(like_count.rows[0].count),
      dislike_count: parseInt(dislike_count.rows[0].count),
      user_vote: user_vote.rows.length > 0 ? user_vote.rows[0].vote_type : null
    });
  } catch (error) {
    logger.error('Vote error', { error: error.message, stack: error.stack, ip: req.ip });
    console.error('Vote error:', error);
    res.status(500).json({ error: "Erreur lors de l'action" });
  }
});

/**
 * POST /:id/comments - Add comment with sanitization
 */
router.post('/:id/comments', checkIpBan, submitLimiter, validateComment, sanitizeCommentData, async (req, res) => {
  const { id } = req.params;
  let { username, comment_text } = req.body;
  const submitter_ip = req.ip;

  // Additional sanitization
  username = sanitizeUsername(username);
  comment_text = sanitizeText(comment_text);

  try {
    const result = await pool.query(
      `INSERT INTO comments (movie_id, username, comment_text, submitter_ip)
      VALUES ($1, $2, $3, $4)
      RETURNING id, username, comment_text, created_at`,
      [id, username, comment_text, submitter_ip]
    );

    const movieResult = await pool.query(`SELECT title FROM movies WHERE id = $1`, [id]);
    const movieTitle = movieResult.rows[0]?.title || 'Film inconnu';

    await sendDiscordWebhook('comments', {
      title: '💬 Nouveau Commentaire',
      color: 3447003,
      fields: [
        { name: 'Film', value: movieTitle, inline: false },
        { name: 'Utilisateur', value: username, inline: true },
        { name: 'IP', value: submitter_ip, inline: true },
        { name: 'Commentaire', value: comment_text.substring(0, 500), inline: false }
      ],
      timestamp: new Date().toISOString()
    });

    res.status(201).json(result.rows[0]);
  } catch (error) {
    logger.error('Add comment error', { error: error.message, stack: error.stack, ip: req.ip });
    console.error('Add comment error:', error);
    res.status(500).json({ error: "Erreur lors de l'ajout du commentaire" });
  }
});

/**
 * POST /comments/:id/report - Report a comment with sanitization
 * IMPORTANT: This route must come BEFORE the comment voting route
 */
router.post('/comments/:id/report', checkIpBan, submitLimiter, validateReport, sanitizeReportData, async (req, res) => {
  const { id } = req.params;
  let { reason, email } = req.body;
  const submitter_ip = req.ip;

  // Additional sanitization
  reason = sanitizeText(reason);

  try {
    const result = await pool.query(
      `SELECT c.*, m.title 
      FROM comments c 
      JOIN movies m ON c.movie_id = m.id 
      WHERE c.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Commentaire non trouvé' });
    }

    const comment = result.rows[0];

    // Store report in database
    await pool.query(
      `INSERT INTO reports (report_type, entity_id, reason, email, submitter_ip)
      VALUES ($1, $2, $3, $4, $5)`,
      ['comment', id, reason, email || null, submitter_ip]
    );

    // Send Discord webhook
    const fields = [
      { name: 'Film', value: comment.title, inline: false },
      { name: 'Utilisateur', value: comment.username, inline: true },
      { name: 'Commentaire', value: comment.comment_text.substring(0, 500), inline: false },
      { name: 'Raison', value: reason.substring(0, 500), inline: false },
      { name: 'ID Commentaire', value: id, inline: true },
      { name: 'IP Signaleur', value: submitter_ip, inline: true }
    ];

    if (email) {
      fields.push({ name: 'Email', value: email, inline: true });
    }

    await sendDiscordWebhook('reports', {
      title: '🚨 Signalement - Commentaire',
      color: 16744448,
      fields,
      timestamp: new Date().toISOString()
    });

    res.json({ message: 'Signalement envoyé avec succès' });
  } catch (error) {
    logger.error('Report comment error', { error: error.message, stack: error.stack, ip: req.ip });
    console.error('Report comment error:', error);
    res.status(500).json({ error: 'Erreur lors du signalement' });
  }
});

/**
 * POST /comments/:id/:vote_type - Vote on comment (like/dislike)
 * IMPORTANT: This route must come AFTER the comment report route
 */
router.post('/comments/:id/:vote_type', checkIpBan, likeLimiter, async (req, res) => {
  const { id, vote_type } = req.params;
  const submitter_ip = req.ip;

  if (!['like', 'dislike'].includes(vote_type)) {
    return res.status(400).json({ error: 'Type de vote invalide' });
  }

  try {
    const existingVote = await pool.query(
      `SELECT * FROM comment_likes WHERE comment_id = $1 AND submitter_ip = $2`,
      [id, submitter_ip]
    );

    if (existingVote.rows.length > 0) {
      const currentVote = existingVote.rows[0].vote_type;

      if (currentVote === vote_type) {
        // Remove vote if clicking same button
        await pool.query(
          `DELETE FROM comment_likes WHERE comment_id = $1 AND submitter_ip = $2`,
          [id, submitter_ip]
        );
      } else {
        // Change vote type
        await pool.query(
          `UPDATE comment_likes SET vote_type = $1 WHERE comment_id = $2 AND submitter_ip = $3`,
          [vote_type, id, submitter_ip]
        );
      }
    } else {
      // New vote
      await pool.query(
        `INSERT INTO comment_likes (comment_id, submitter_ip, vote_type) VALUES ($1, $2, $3)`,
        [id, submitter_ip, vote_type]
      );
    }

    // Get counts
    const like_count = await pool.query(
      `SELECT COUNT(*) FROM comment_likes WHERE comment_id = $1 AND vote_type = $2`,
      [id, 'like']
    );
    const dislike_count = await pool.query(
      `SELECT COUNT(*) FROM comment_likes WHERE comment_id = $1 AND vote_type = $2`,
      [id, 'dislike']
    );

    // Get user's current vote
    const user_vote = await pool.query(
      `SELECT vote_type FROM comment_likes WHERE comment_id = $1 AND submitter_ip = $2`,
      [id, submitter_ip]
    );

    // Get comment details for webhook
    const comment = await pool.query(
      `SELECT c.username, c.comment_text, m.title 
      FROM comments c 
      JOIN movies m ON c.movie_id = m.id 
      WHERE c.id = $1`,
      [id]
    );

    if (comment.rows.length > 0) {
      await sendDiscordWebhook('likes', {
        title: vote_type === 'like' ? '👍 Like Commentaire' : '👎 Dislike Commentaire',
        color: vote_type === 'like' ? 3066993 : 15158332,
        fields: [
          { name: 'Film', value: comment.rows[0].title, inline: false },
          { name: 'Commentaire de', value: comment.rows[0].username, inline: false },
          { name: 'Likes', value: like_count.rows[0].count, inline: true },
          { name: 'Dislikes', value: dislike_count.rows[0].count, inline: true }
        ],
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      like_count: parseInt(like_count.rows[0].count),
      dislike_count: parseInt(dislike_count.rows[0].count),
      user_vote: user_vote.rows.length > 0 ? user_vote.rows[0].vote_type : null
    });
  } catch (error) {
    logger.error('Comment vote error', { error: error.message, stack: error.stack, ip: req.ip });
    console.error('Comment vote error:', error);
    res.status(500).json({ error: "Erreur lors de l'action" });
  }
});

/**
 * GET /:id - Get movie details with all submissions and comments
 */
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  const userIp = req.ip;

  try {
    const movieResult = await pool.query(`SELECT * FROM movies WHERE id = $1`, [id]);

    if (movieResult.rows.length === 0) {
      return res.status(404).json({ error: 'Film non trouvé' });
    }

    const submissionsResult = await pool.query(
      `SELECT s.*,
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
      ORDER BY s.created_at DESC`,
      [id, userIp]
    );

    const commentsResult = await pool.query(
      `SELECT c.id, c.username, c.comment_text, c.created_at,
        (SELECT COUNT(*) FROM comment_likes WHERE comment_id = c.id AND vote_type = 'like') as like_count,
        (SELECT COUNT(*) FROM comment_likes WHERE comment_id = c.id AND vote_type = 'dislike') as dislike_count,
        (SELECT vote_type FROM comment_likes WHERE comment_id = c.id AND submitter_ip = $2) as user_vote
      FROM comments c
      WHERE c.movie_id = $1
      ORDER BY c.created_at DESC`,
      [id, userIp]
    );

    // Map user_vote to boolean flags for frontend compatibility
    const submissions = submissionsResult.rows.map(sub => ({
      ...sub,
      user_liked: sub.user_vote === 'like',
      user_disliked: sub.user_vote === 'dislike'
    }));

    const comments = commentsResult.rows.map(comment => ({
      ...comment,
      user_liked: comment.user_vote === 'like',
      user_disliked: comment.user_vote === 'dislike'
    }));

    res.json({
      movie: movieResult.rows[0],
      submissions,
      comments
    });
  } catch (error) {
    logger.error('Get movie details error', { error: error.message, stack: error.stack, ip: req.ip });
    console.error('Get movie details error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des détails' });
  }
});


export default router;
