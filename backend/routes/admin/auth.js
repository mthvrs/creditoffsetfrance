import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool from '../../config/database.js';
import { loginLimiter } from '../../middleware/rateLimiter.js';
import { sendDiscordWebhook } from '../../utils/discord.js';
import logger from '../../utils/logger.js';

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

export default router;
