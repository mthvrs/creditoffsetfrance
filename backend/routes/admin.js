import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool from '../config/database.js';
import { authenticateAdmin } from '../middleware/auth.js';
import { loginLimiter } from '../middleware/rateLimiter.js';
import { validateIpBan } from '../middleware/validation.js';
import { sendDiscordWebhook } from '../utils/discord.js';
import logger from '../utils/logger.js';
import axios from 'axios';
import { sanitizeText, sanitizeIP, sanitizeUsername } from '../utils/sanitizer.js';

const router = express.Router();

/**
 * POST /login - Admin login
 */
router.post('/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body;

  try {
    // Get user from database
    const result = await pool.query(
      'SELECT * FROM admin_users WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Identifiants invalides' });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      return res.status(401).json({ error: 'Identifiants invalides' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username },
      process.env.ADMIN_JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ token, username: user.username });
  } catch (error) {
    logger.error('Login error', { error: error.message });
    res.status(500).json({ error: 'Erreur de connexion' });
  }

  await sendDiscordWebhook('admin', {
    title: '🔐 Connexion Admin',
    color: 3447003,
    fields: [
      { name: '⏰ Date', value: new Date().toLocaleString('fr-FR'), inline: false }
    ],
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /submissions - Get all submissions with details (PAGINATED)
 */
router.get('/submissions', authenticateAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const offset = (page - 1) * limit;

    // Get total count
    const countResult = await pool.query('SELECT COUNT(*) FROM submissions');
    const totalItems = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalItems / limit);

    const result = await pool.query(`
      SELECT 
        s.*, m.title, m.tmdb_id, m.poster_path,
        (SELECT COUNT(*) FROM likes WHERE submission_id = s.id AND vote_type = 'like') as like_count,
        (SELECT COUNT(*) FROM likes WHERE submission_id = s.id AND vote_type = 'dislike') as dislike_count,
        (
          SELECT json_agg(
            json_build_object(
              'id', pcs.id,
              'start_time', pcs.start_time,
              'end_time', pcs.end_time,
              'description', pcs.description,
              'scene_order', pcs.scene_order
            ) ORDER BY pcs.scene_order
          )
          FROM post_credit_scenes pcs
          WHERE pcs.submission_id = s.id
        ) as post_credit_scenes
      FROM submissions s
      JOIN movies m ON s.movie_id = m.id
      ORDER BY s.created_at DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);

    res.json({
      data: result.rows,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems,
        itemsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });
  } catch (error) {
    logger.error('Get submissions error:', { error: error.message, stack: error.stack, ip: req.ip });
    console.error('Get submissions error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération' });
  }
});

/**
 * GET /comments - Get all comments (PAGINATED)
 */
router.get('/comments', authenticateAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const offset = (page - 1) * limit;

    // Get total count
    const countResult = await pool.query('SELECT COUNT(*) FROM comments');
    const totalItems = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalItems / limit);

    const result = await pool.query(`
      SELECT 
        c.*, m.title, m.tmdb_id,
        (SELECT COUNT(*) FROM comment_likes WHERE comment_id = c.id AND vote_type = 'like') as like_count,
        (SELECT COUNT(*) FROM comment_likes WHERE comment_id = c.id AND vote_type = 'dislike') as dislike_count
      FROM comments c
      JOIN movies m ON c.movie_id = m.id
      ORDER BY c.created_at DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);

    res.json({
      data: result.rows,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems,
        itemsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });
  } catch (error) {
    logger.error('Get comments error:', { error: error.message, stack: error.stack, ip: req.ip });
    console.error('Get comments error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération' });
  }
});

/**
 * GET /reports - Get all reports (PAGINATED)
 */
router.get('/reports', authenticateAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const offset = (page - 1) * limit;

    // Get total count
    const countResult = await pool.query('SELECT COUNT(*) FROM reports');
    const totalItems = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalItems / limit);

    const result = await pool.query(`
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
    `, [limit, offset]);

    res.json({
      data: result.rows,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems,
        itemsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });
  } catch (error) {
    logger.error('Get reports error:', { error: error.message, stack: error.stack, ip: req.ip });
    console.error('Get reports error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération' });
  }
});

/**
 * DELETE /reports/:id - Delete a report
 */
router.delete('/reports/:id', authenticateAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query('DELETE FROM reports WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Signalement non trouvé' });
    }

    res.json({ message: 'Signalement supprimé' });
  } catch (error) {
    logger.error('Delete report error:', { error: error.message, stack: error.stack, ip: req.ip });
    console.error('Delete report error:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression' });
  }
});

/**
 * GET /ip-bans - Get all IP bans (PAGINATED)
 */
router.get('/ip-bans', authenticateAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const offset = (page - 1) * limit;

    // Get total count
    const countResult = await pool.query('SELECT COUNT(*) FROM ip_bans');
    const totalItems = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalItems / limit);

    const result = await pool.query(`
      SELECT * FROM ip_bans 
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);

    res.json({
      data: result.rows,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems,
        itemsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });
  } catch (error) {
    logger.error('GET IP Bans error:', { error: error.message, stack: error.stack, ip: req.ip });
    console.error('Get IP bans error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération' });
  }
});

/**
 * POST /ip-bans - Ban an IP with sanitization
 */
router.post('/ip-bans', authenticateAdmin, validateIpBan, async (req, res) => {
  let { ip_address, reason } = req.body;

  if (!ip_address) {
    return res.status(400).json({ error: 'Adresse IP requise' });
  }

  // Sanitize inputs
  ip_address = sanitizeIP(ip_address);
  reason = reason ? sanitizeText(reason) : 'Non spécifié';

  if (!ip_address) {
    return res.status(400).json({ error: 'Adresse IP invalide' });
  }

  try {
    const result = await pool.query(`
      INSERT INTO ip_bans (ip_address, reason, banned_by)
      VALUES ($1, $2, 'admin')
      ON CONFLICT (ip_address) DO UPDATE SET
        reason = EXCLUDED.reason,
        created_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [ip_address, reason]);

    await sendDiscordWebhook('admin', {
      title: '🚫 IP Bannie',
      color: 15158332,
      fields: [
        { name: '🌐 IP', value: ip_address, inline: false },
        { name: '📍 Raison', value: reason, inline: false }
      ],
      timestamp: new Date().toISOString()
    });

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('IP Bans error:', { error: error.message, stack: error.stack, ip: req.ip });
    console.error('Ban IP error:', error);
    res.status(500).json({ error: 'Erreur lors du bannissement' });
  }
});

/**
 * DELETE /ip-bans/:id - Unban an IP
 */
router.delete('/ip-bans/:id', authenticateAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query('DELETE FROM ip_bans WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Ban non trouvé' });
    }

    await sendDiscordWebhook('admin', {
      title: '✅ IP Débannie',
      color: 3066993,
      fields: [
        { name: '🌐 IP', value: result.rows[0].ip_address, inline: false }
      ],
      timestamp: new Date().toISOString()
    });

    res.json({ message: 'IP débannie' });
  } catch (error) {
    logger.error('IP Unban error:', { error: error.message, stack: error.stack, ip: req.ip });
    console.error('Unban IP error:', error);
    res.status(500).json({ error: 'Erreur lors du débannissement' });
  }
});

/**
 * POST /bulk-delete-ip - Bulk delete all content from an IP with sanitization
 * Also deletes orphaned movies (movies with no submissions left) and their remaining comments
 */
router.post('/bulk-delete-ip', authenticateAdmin, async (req, res) => {
  let { ip_address } = req.body;

  if (!ip_address) {
    return res.status(400).json({ error: 'Adresse IP requise' });
  }

  // Sanitize IP address
  ip_address = sanitizeIP(ip_address);

  if (!ip_address) {
    return res.status(400).json({ error: 'Adresse IP invalide' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get IDs of submissions and comments to delete their reports
    const submissionIds = await client.query(
      'SELECT id, movie_id FROM submissions WHERE submitter_ip = $1',
      [ip_address]
    );
    const commentIds = await client.query(
      'SELECT id FROM comments WHERE submitter_ip = $1',
      [ip_address]
    );

    // Get movie IDs that will be affected
    const affectedMovieIds = [...new Set(submissionIds.rows.map(r => r.movie_id))];

    // Count what will be deleted
    const submissionCount = submissionIds.rows.length;
    const commentCount = commentIds.rows.length;
    const likeCount = await client.query(
      'SELECT COUNT(*) FROM likes WHERE submitter_ip = $1',
      [ip_address]
    );
    const commentLikeCount = await client.query(
      'SELECT COUNT(*) FROM comment_likes WHERE submitter_ip = $1',
      [ip_address]
    );

    // Delete reports for these submissions and comments
    let reportCount = 0;
    if (submissionIds.rows.length > 0) {
      const subIds = submissionIds.rows.map(r => r.id);
      const reportResult = await client.query(
        'DELETE FROM reports WHERE report_type = $1 AND entity_id = ANY($2::int[])',
        ['submission', subIds]
      );
      reportCount += reportResult.rowCount || 0;
    }
    if (commentIds.rows.length > 0) {
      const comIds = commentIds.rows.map(r => r.id);
      const reportResult = await client.query(
        'DELETE FROM reports WHERE report_type = $1 AND entity_id = ANY($2::int[])',
        ['comment', comIds]
      );
      reportCount += reportResult.rowCount || 0;
    }

    // Delete all content from this IP (cascading will handle likes and post_credit_scenes)
    await client.query('DELETE FROM comment_likes WHERE submitter_ip = $1', [ip_address]);
    await client.query('DELETE FROM likes WHERE submitter_ip = $1', [ip_address]);
    await client.query('DELETE FROM comments WHERE submitter_ip = $1', [ip_address]);
    await client.query('DELETE FROM submissions WHERE submitter_ip = $1', [ip_address]);

    // Find and delete orphaned movies (movies with no submissions left)
    // This will cascade delete ALL remaining comments via ON DELETE CASCADE
    let orphanedMovieCount = 0;
    if (affectedMovieIds.length > 0) {
      const orphanedResult = await client.query(`
        DELETE FROM movies 
        WHERE id = ANY($1::int[]) 
        AND NOT EXISTS (
          SELECT 1 FROM submissions WHERE movie_id = movies.id
        )
        RETURNING id
      `, [affectedMovieIds]);
      orphanedMovieCount = orphanedResult.rowCount || 0;

      // Update last_submission_at for remaining affected movies
      await client.query(`
        UPDATE movies m
        SET last_submission_at = (
          SELECT MAX(created_at)
          FROM submissions s
          WHERE s.movie_id = m.id
        )
        WHERE id = ANY($1::int[])
      `, [affectedMovieIds]);
    }

    await client.query('COMMIT');

    await sendDiscordWebhook('admin', {
      title: '🗑️ Suppression en masse',
      color: 15158332,
      fields: [
        { name: '🌐 IP', value: ip_address, inline: false },
        { name: '📊 Soumissions supprimées', value: String(submissionCount), inline: true },
        { name: '💬 Commentaires supprimés', value: String(commentCount), inline: true },
        { name: '👍 Likes supprimés', value: likeCount.rows[0].count, inline: true },
        { name: '💬👍 Comment likes supprimés', value: commentLikeCount.rows[0].count, inline: true },
        { name: '🚩 Signalements supprimés', value: String(reportCount), inline: true },
        { name: '🎬 Films orphelins supprimés', value: String(orphanedMovieCount), inline: true }
      ],
      timestamp: new Date().toISOString()
    });

    res.json({
      message: 'Contenu supprimé',
      deleted: {
        submissions: submissionCount,
        comments: commentCount,
        likes: parseInt(likeCount.rows[0].count),
        comment_likes: parseInt(commentLikeCount.rows[0].count),
        reports: reportCount,
        orphaned_movies: orphanedMovieCount
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('BULK Delete error:', { error: error.message, stack: error.stack, ip: req.ip });
    console.error('Bulk delete error:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression' });
  } finally {
    client.release();
  }
});

/**
 * PUT /submissions/:id - Update submission with sanitization
 */
router.put('/submissions/:id', authenticateAdmin, async (req, res) => {
  const { id } = req.params;
  let { cpl_title, version, ffec, ffmc, notes, source, source_other } = req.body;

  // Sanitize all text inputs
  cpl_title = sanitizeText(cpl_title);
  version = version ? sanitizeText(version) : null;
  notes = notes ? sanitizeText(notes) : null;
  source_other = source_other ? sanitizeText(source_other) : null;

  try {
    const result = await pool.query(`
      UPDATE submissions
      SET cpl_title = $1, version = $2, ffec = $3, ffmc = $4, notes = $5, source = $6, source_other = $7, updated_at = CURRENT_TIMESTAMP
      WHERE id = $8
      RETURNING *
    `, [cpl_title, version, ffec, ffmc, notes, source, source_other, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Soumission non trouvée' });
    }

    await sendDiscordWebhook('admin', {
      title: '✏️ Soumission modifiée',
      color: 3447003,
      fields: [
        { name: '🔗 ID', value: `#${id}`, inline: true },
        { name: '📦 Version', value: cpl_title, inline: false }
      ],
      timestamp: new Date().toISOString()
    });

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Entity comment or submission edition error:', { error: error.message, stack: error.stack, ip: req.ip });
    console.error('Update error:', error);
    res.status(500).json({ error: 'Erreur lors de la modification' });
  }
});

/**
 * DELETE /submissions/:id - Delete submission and associated reports
 * Also deletes the movie if it has no remaining submissions
 */
router.delete('/submissions/:id', authenticateAdmin, async (req, res) => {
  const { id } = req.params;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get submission info before deleting
    const submissionResult = await client.query(
      'SELECT * FROM submissions WHERE id = $1',
      [id]
    );

    if (submissionResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Soumission non trouvée' });
    }

    const movieId = submissionResult.rows[0].movie_id;

    // Delete associated reports
    await client.query(
      'DELETE FROM reports WHERE report_type = $1 AND entity_id = $2',
      ['submission', id]
    );

    // Delete submission (cascades to likes and post_credit_scenes via ON DELETE CASCADE)
    await client.query('DELETE FROM submissions WHERE id = $1', [id]);

    // Check if movie has no more submissions and delete it if orphaned
    const remainingSubmissions = await client.query(
      'SELECT COUNT(*) FROM submissions WHERE movie_id = $1',
      [movieId]
    );

    let movieDeleted = false;
    if (parseInt(remainingSubmissions.rows[0].count) === 0) {
      await client.query('DELETE FROM movies WHERE id = $1', [movieId]);
      movieDeleted = true;
    } else {
      // Recalculate last_submission_at
      await client.query(`
        UPDATE movies SET last_submission_at = (
          SELECT MAX(created_at) FROM submissions WHERE movie_id = $1
        ) WHERE id = $1
      `, [movieId]);
    }

    await client.query('COMMIT');

    await sendDiscordWebhook('admin', {
      title: '🗑️ Soumission supprimée',
      color: 15158332,
      fields: [
        { name: '🔗 ID', value: `#${id}`, inline: true },
        { name: '📦 Version', value: submissionResult.rows[0].cpl_title, inline: false },
        { name: '🎬 Film orphelin supprimé', value: movieDeleted ? 'Oui' : 'Non', inline: true }
      ],
      timestamp: new Date().toISOString()
    });

    res.json({ 
      message: movieDeleted 
        ? 'Soumission et film orphelin supprimés' 
        : 'Soumission supprimée' 
    });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Entity comment or submission delete error:', { error: error.message, stack: error.stack, ip: req.ip });
    console.error('Delete error:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression' });
  } finally {
    client.release();
  }
});

/**
 * DELETE /comments/:id - Delete comment and associated reports
 */
router.delete('/comments/:id', authenticateAdmin, async (req, res) => {
  const { id } = req.params;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get comment info before deleting
    const commentResult = await client.query(
      'SELECT * FROM comments WHERE id = $1',
      [id]
    );

    if (commentResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Commentaire non trouvé' });
    }

    // Delete associated reports
    await client.query(
      'DELETE FROM reports WHERE report_type = $1 AND entity_id = $2',
      ['comment', id]
    );

    // Delete comment (cascades to comment_likes via ON DELETE CASCADE)
    await client.query('DELETE FROM comments WHERE id = $1', [id]);

    await client.query('COMMIT');

    await sendDiscordWebhook('admin', {
      title: '🗑️ Commentaire supprimé',
      color: 15158332,
      fields: [
        { name: '🔗 ID', value: `#${id}`, inline: true },
        { name: '👤 Utilisateur', value: commentResult.rows[0].username, inline: true }
      ],
      timestamp: new Date().toISOString()
    });

    res.json({ message: 'Commentaire et données associées supprimés' });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Entity comment delete error:', { error: error.message, stack: error.stack, ip: req.ip });
    console.error('Delete error:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression' });
  } finally {
    client.release();
  }
});

/**
 * DELETE /movies/:id - Delete movie and all its data
 */
router.delete('/movies/:id', authenticateAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query('DELETE FROM movies WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Film non trouvé' });
    }

    await sendDiscordWebhook('admin', {
      title: '🗑️ Film supprimé',
      color: 15158332,
      fields: [
        { name: '🎬 Titre', value: result.rows[0].title, inline: false }
      ],
      timestamp: new Date().toISOString()
    });

    res.json({ message: 'Film et données associées supprimés' });
  } catch (error) {
    logger.error('submission delete error:', { error: error.message, stack: error.stack, ip: req.ip });
    console.error('Delete movie error:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression' });
  }
});

/**
 * POST /generate-test-data - Generate realistic test data with sanitization
 */
router.post('/generate-test-data', authenticateAdmin, async (req, res) => {
  try {
    const response = await axios.get(
      'https://api.themoviedb.org/3/movie/popular',
      {
        params: { language: 'fr-FR', region: 'FR', page: 1 },
        headers: { Authorization: `Bearer ${process.env.TMDB_BEARER_TOKEN}` }
      }
    );

    const movies = response.data.results.slice(0, 50);
    let insertedCount = 0;

    const versions = ['VOSTFR', 'VF', 'Version longue', 'EN-FR-OCAP_FR-FR_VF-XX', 'BluRay', 'DCP Standard', 'Version courte'];
    const sources = ['Observation en salle', 'Inclus dans le DCP', 'Communications du distributeur / labo'];
    // Removed null values - username is now required
    const usernames = ['Alice', 'Bob', 'Charlie', 'Diana', 'TestBot', 'Projectionniste42', 'CinephileX', 'TechnicienDCP'];
    const notes = [
      'Attention, générique animé pendant 2 minutes',
      'Crédits très courts',
      'Pas de logo studio au début',
      'Version avec sous-titres forcés',
      null, null, null
    ];

    for (const movie of movies) {
      try {
        const detailsResponse = await axios.get(
          `https://api.themoviedb.org/3/movie/${movie.id}`,
          {
            params: { language: 'fr-FR' },
            headers: { Authorization: `Bearer ${process.env.TMDB_BEARER_TOKEN}` }
          }
        );

        const runtime = detailsResponse.data.runtime || 120;

        const movieResult = await pool.query(`
          INSERT INTO movies (tmdb_id, title, original_title, release_date, poster_path, runtime)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (tmdb_id) DO NOTHING
          RETURNING id
        `, [movie.id, movie.title, movie.original_title, movie.release_date, movie.poster_path, runtime]);

        if (movieResult.rows.length > 0) {
          const movie_id = movieResult.rows[0].id;
          const numVersions = Math.random() < 0.7 ? 1 : Math.random() < 0.8 ? 2 : 3;

          for (let v = 0; v < numVersions; v++) {
            const ffecMinutes = Math.floor(runtime * (0.82 + Math.random() * 0.06));
            const ffmcMinutes = Math.floor(runtime * (0.88 + Math.random() * 0.06));
            const ffec = `${Math.floor(ffecMinutes / 60)}:${(ffecMinutes % 60).toString().padStart(2, '0')}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`;
            const ffmc = `${Math.floor(ffmcMinutes / 60)}:${(ffmcMinutes % 60).toString().padStart(2, '0')}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`;

            const source = sources[Math.floor(Math.random() * sources.length)];
            const cpl_title = versions[Math.floor(Math.random() * versions.length)];
            let username = usernames[Math.floor(Math.random() * usernames.length)];
            let note = notes[Math.floor(Math.random() * notes.length)];

            // Sanitize username and notes - username is always present now
            username = sanitizeUsername(username);
            note = note ? sanitizeText(note) : null;

            const submissionResult = await pool.query(`
              INSERT INTO submissions (movie_id, cpl_title, ffec, ffmc, notes, source, submitter_ip, username)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
              RETURNING *
            `, [movie_id, cpl_title, ffec, ffmc, note, source, '127.0.0.1', username]);

            const submission_id = submissionResult.rows[0].id;

            // Update movie last_submission_at
            await pool.query(
              `UPDATE movies SET last_submission_at = $1 WHERE id = $2`,
              [submissionResult.rows[0].created_at, movie_id]
            );

            // Add some random likes (0-15 likes per submission)
            const numLikes = Math.floor(Math.random() * 16);
            for (let l = 0; l < numLikes; l++) {
              const fakeIp = `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
              try {
                await pool.query(`
                  INSERT INTO likes (submission_id, submitter_ip, vote_type)
                  VALUES ($1, $2, $3)
                  ON CONFLICT DO NOTHING
                `, [submission_id, fakeIp, 'like']);
              } catch (e) {
                // Ignore duplicate errors
              }
            }

            // 30% chance of post-credit scenes
            if (Math.random() < 0.3) {
              const numScenes = Math.random() < 0.7 ? 1 : 2;
              
              for (let s = 0; s < numScenes; s++) {
                const sceneStart = Math.floor(runtime + 2 + Math.random() * 5);
                const sceneDuration = Math.floor(1 + Math.random() * 3);
                const sceneEnd = sceneStart + sceneDuration;

                const start_time = `${Math.floor(sceneStart / 60)}:${(sceneStart % 60).toString().padStart(2, '0')}:00`;
                const end_time = `${Math.floor(sceneEnd / 60)}:${(sceneEnd % 60).toString().padStart(2, '0')}:00`;

                const descriptions = [
                  'Scène avec les personnages principaux',
                  'Blague post-générique',
                  'Teaser pour la suite',
                  'Scène humoristique',
                  'Setup pour le prochain film'
                ];
                let description = descriptions[Math.floor(Math.random() * descriptions.length)];
                
                // Sanitize description
                description = sanitizeText(description);

                await pool.query(`
                  INSERT INTO post_credit_scenes (submission_id, start_time, end_time, description, scene_order)
                  VALUES ($1, $2, $3, $4, $5)
                `, [submission_id, start_time, end_time, description, s + 1]);
              }
            }
          }

          // Add 0-3 random comments per movie
          const numComments = Math.floor(Math.random() * 4);
          const commentTexts = [
            'Les timings sont corrects, vérifié en salle.',
            'Attention, il y a une fausse fin avant le générique !',
            'Le FFEC inclut 30 secondes d\'animation avant le texte.',
            'Version VOSTFR différente de la VF, attention aux timings.',
            'Confirmé, les scènes post-crédit sont bien présentes.',
            'Le DCP que j\'ai reçu a des timings légèrement différents.',
            'Super utile, merci pour la contribution !',
            'Il manque une scène post-crédit, il y en a une après les logos finaux.'
          ];

          for (let c = 0; c < numComments; c++) {
            let commentUsername = usernames[Math.floor(Math.random() * usernames.length)];
            let comment_text = commentTexts[Math.floor(Math.random() * commentTexts.length)];
            
            // Sanitize comment data - username is always present
            commentUsername = sanitizeUsername(commentUsername);
            comment_text = sanitizeText(comment_text);
            
            await pool.query(`
              INSERT INTO comments (movie_id, username, comment_text, submitter_ip)
              VALUES ($1, $2, $3, $4)
            `, [movie_id, commentUsername, comment_text, '127.0.0.1']);
          }

          insertedCount++;
        }
      } catch (movieError) {
        logger.error(`Error inserting movie ${movie.id}:`, { error: movieError.message, stack: movieError.stack, ip: req.ip });
        console.error(`Error inserting movie ${movie.id}:`, movieError);
      }
    }

    await sendDiscordWebhook('admin', {
      title: '🎲 Données de test générées',
      color: 3066993,
      fields: [
        { name: '📊 Films', value: `${insertedCount}`, inline: true }
      ],
      timestamp: new Date().toISOString()
    });

    res.json({ message: `${insertedCount} films générés avec succès (avec versions multiples, likes, scènes post-crédit, et commentaires)` });
  } catch (error) {
    logger.error('Generate test data error:', { error: error.message, stack: error.stack, ip: req.ip });
    console.error('Generate test data error:', error);
    res.status(500).json({ error: 'Erreur lors de la génération' });
  }
});

/**
 * GET /stats - Get platform statistics
 */
router.get('/stats', authenticateAdmin, async (req, res) => {
  try {
    const stats = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM movies) as total_movies,
        (SELECT COUNT(*) FROM submissions) as total_submissions,
        (SELECT COUNT(*) FROM comments) as total_comments,
        (SELECT COUNT(*) FROM likes WHERE vote_type = 'like') as total_likes,
        (SELECT COUNT(*) FROM likes WHERE vote_type = 'dislike') as total_dislikes,
        (SELECT COUNT(*) FROM comment_likes WHERE vote_type = 'like') as total_comment_likes,
        (SELECT COUNT(*) FROM comment_likes WHERE vote_type = 'dislike') as total_comment_dislikes,
        (SELECT COUNT(*) FROM ip_bans) as total_bans,
        (SELECT COUNT(*) FROM reports) as total_reports,
        (SELECT COUNT(DISTINCT submitter_ip) FROM submissions) as unique_contributors
    `);

    res.json(stats.rows[0]);
  } catch (error) {
    logger.error('Stats data error:', { error: error.message, stack: error.stack, ip: req.ip });
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des stats' });
  }
});

export default router;
