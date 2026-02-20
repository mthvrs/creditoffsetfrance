import express from 'express';
import pool from '../../config/database.js';
import { authenticateAdmin } from '../../middleware/auth.js';
import logger from '../../utils/logger.js';

const router = express.Router();

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

export default router;
