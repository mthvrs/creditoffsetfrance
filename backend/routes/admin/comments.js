import express from 'express';
import pool from '../../config/database.js';
import { authenticateAdmin } from '../../middleware/auth.js';
import { sendDiscordWebhook } from '../../utils/discord.js';
import logger from '../../utils/logger.js';

const router = express.Router();

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

export default router;
