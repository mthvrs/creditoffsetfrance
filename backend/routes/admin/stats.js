import express from 'express';
import pool from '../../config/database.js';
import { authenticateAdmin } from '../../middleware/auth.js';
import logger from '../../utils/logger.js';

const router = express.Router();

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
