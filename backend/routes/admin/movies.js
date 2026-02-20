import express from 'express';
import pool from '../../config/database.js';
import { authenticateAdmin } from '../../middleware/auth.js';
import { sendDiscordWebhook } from '../../utils/discord.js';
import logger from '../../utils/logger.js';

const router = express.Router();

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

export default router;
