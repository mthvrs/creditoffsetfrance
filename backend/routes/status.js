import express from 'express';
import statusMonitor from '../utils/tmdbStatusMonitor.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * GET /api/status/tmdb
 * Returns current TMDB service status
 */
router.get('/tmdb', (req, res) => {
  try {
    const status = statusMonitor.getStatus();
    
    res.json(status);
  } catch (error) {
    logger.error('Error getting TMDB status', {
      error: error.message,
      stack: error.stack,
      ip: req.ip
    });
    
    // Return safe default on error
    res.json({
      hasIssues: false,
      services: {
        api: { status: 'Unknown', description: '' },
        image: { status: 'Unknown', description: '' }
      },
      lastChecked: null,
      message: ''
    });
  }
});

export default router;
