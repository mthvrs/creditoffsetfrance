import express from 'express';
import pool from '../../config/database.js';
import { authenticateAdmin } from '../../middleware/auth.js';
import { sendDiscordWebhook } from '../../utils/discord.js';
import logger from '../../utils/logger.js';
import { sanitizeText } from '../../utils/sanitizer.js';

const router = express.Router();

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

export default router;
