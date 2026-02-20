import express from 'express';
import pool from '../../config/database.js';
import { authenticateAdmin } from '../../middleware/auth.js';
import { validateIpBan } from '../../middleware/validation.js';
import { sendDiscordWebhook } from '../../utils/discord.js';
import logger from '../../utils/logger.js';
import { sanitizeText, sanitizeIP } from '../../utils/sanitizer.js';

const router = express.Router();

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

export default router;
