import pool from '../config/database.js';

export async function checkIpBan(req, res, next) {
  const ip = req.ip;

  try {
    const result = await pool.query(
      'SELECT * FROM ip_bans WHERE ip_address = $1',
      [ip]
    );

    if (result.rows.length > 0) {
      return res.status(403).json({ 
        error: 'Votre adresse IP a été bannie. Contactez l\'administrateur si vous pensez qu\'il s\'agit d\'une erreur.' 
      });
    }

    next();
  } catch (error) {
    console.error('IP ban check error:', error);
    next(); // Don't block on error
  }
}
