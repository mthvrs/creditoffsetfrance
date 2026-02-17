import express from 'express';
import axios from 'axios';

const router = express.Router();

router.get('/tmdb', async (req, res) => {
  const { query } = req.query;

  if (!query || query.length < 2) {
    return res.status(400).json({ error: 'Requête trop courte' });
  }

  try {
    const response = await axios.get(
      `https://api.themoviedb.org/3/search/movie`,
      {
        params: {
          query,
          language: 'fr-FR',
          region: 'FR',
          include_adult: false,
        },
        headers: {
          Authorization: `Bearer ${process.env.TMDB_BEARER_TOKEN}`,
        },
      }
    );

    res.json(response.data);
  } catch (error) {
    logger.error('TMDB search error:', { error: error.message, stack: error.stack, ip: req.ip });
    console.error('TMDB search error:', error);
    res.status(500).json({ error: 'Erreur lors de la recherche' });
  }
});

router.get('/tmdb/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const response = await axios.get(
      `https://api.themoviedb.org/3/movie/${id}`,
      {
        params: { language: 'fr-FR' },
        headers: {
          Authorization: `Bearer ${process.env.TMDB_BEARER_TOKEN}`,
        },
      }
    );

    res.json(response.data);
  } catch (error) {
    logger.error('TMDB movie details error:', { error: error.message, stack: error.stack, ip: req.ip });
    console.error('TMDB movie details error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des détails' });
  }
});

export default router;
