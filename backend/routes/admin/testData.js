import express from 'express';
import axios from 'axios';
import pool from '../../config/database.js';
import { authenticateAdmin } from '../../middleware/auth.js';
import { sendDiscordWebhook } from '../../utils/discord.js';
import logger from '../../utils/logger.js';
import { sanitizeText, sanitizeUsername } from '../../utils/sanitizer.js';

const router = express.Router();

/**
 * POST /generate-test-data - Generate realistic test data with sanitization
 */
router.post('/generate-test-data', authenticateAdmin, async (req, res) => {
  try {
    const response = await axios.get(
      'https://api.themoviedb.org/3/movie/popular',
      {
        params: { language: 'fr-FR', region: 'FR', page: 1 },
        headers: { Authorization: `Bearer ${process.env.TMDB_BEARER_TOKEN}` }
      }
    );

    const movies = response.data.results.slice(0, 50);
    let insertedCount = 0;

    const versions = ['VOSTFR', 'VF', 'Version longue', 'EN-FR-OCAP_FR-FR_VF-XX', 'BluRay', 'DCP Standard', 'Version courte'];
    const sources = ['Observation en salle', 'Inclus dans le DCP', 'Communications du distributeur / labo'];
    // Removed null values - username is now required
    const usernames = ['Alice', 'Bob', 'Charlie', 'Diana', 'TestBot', 'Projectionniste42', 'CinephileX', 'TechnicienDCP'];
    const notes = [
      'Attention, générique animé pendant 2 minutes',
      'Crédits très courts',
      'Pas de logo studio au début',
      'Version avec sous-titres forcés',
      null, null, null
    ];

    for (const movie of movies) {
      try {
        const detailsResponse = await axios.get(
          `https://api.themoviedb.org/3/movie/${movie.id}`,
          {
            params: { language: 'fr-FR' },
            headers: { Authorization: `Bearer ${process.env.TMDB_BEARER_TOKEN}` }
          }
        );

        const runtime = detailsResponse.data.runtime || 120;

        const movieResult = await pool.query(`
          INSERT INTO movies (tmdb_id, title, original_title, release_date, poster_path, runtime)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (tmdb_id) DO NOTHING
          RETURNING id
        `, [movie.id, movie.title, movie.original_title, movie.release_date, movie.poster_path, runtime]);

        if (movieResult.rows.length > 0) {
          const movie_id = movieResult.rows[0].id;
          const numVersions = Math.random() < 0.7 ? 1 : Math.random() < 0.8 ? 2 : 3;

          for (let v = 0; v < numVersions; v++) {
            const ffecMinutes = Math.floor(runtime * (0.82 + Math.random() * 0.06));
            const ffmcMinutes = Math.floor(runtime * (0.88 + Math.random() * 0.06));
            const ffec = `${Math.floor(ffecMinutes / 60)}:${(ffecMinutes % 60).toString().padStart(2, '0')}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`;
            const ffmc = `${Math.floor(ffmcMinutes / 60)}:${(ffmcMinutes % 60).toString().padStart(2, '0')}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`;

            const source = sources[Math.floor(Math.random() * sources.length)];
            const cpl_title = versions[Math.floor(Math.random() * versions.length)];
            let username = usernames[Math.floor(Math.random() * usernames.length)];
            let note = notes[Math.floor(Math.random() * notes.length)];

            // Sanitize username and notes - username is always present now
            username = sanitizeUsername(username);
            note = note ? sanitizeText(note) : null;

            const submissionResult = await pool.query(`
              INSERT INTO submissions (movie_id, cpl_title, ffec, ffmc, notes, source, submitter_ip, username)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
              RETURNING id
            `, [movie_id, cpl_title, ffec, ffmc, note, source, '127.0.0.1', username]);

            const submission_id = submissionResult.rows[0].id;

            // Add some random likes (0-15 likes per submission)
            const numLikes = Math.floor(Math.random() * 16);
            for (let l = 0; l < numLikes; l++) {
              const fakeIp = `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
              try {
                await pool.query(`
                  INSERT INTO likes (submission_id, submitter_ip, vote_type)
                  VALUES ($1, $2, $3)
                  ON CONFLICT DO NOTHING
                `, [submission_id, fakeIp, 'like']);
              } catch (e) {
                // Ignore duplicate errors
              }
            }

            // 30% chance of post-credit scenes
            if (Math.random() < 0.3) {
              const numScenes = Math.random() < 0.7 ? 1 : 2;

              for (let s = 0; s < numScenes; s++) {
                const sceneStart = Math.floor(runtime + 2 + Math.random() * 5);
                const sceneDuration = Math.floor(1 + Math.random() * 3);
                const sceneEnd = sceneStart + sceneDuration;

                const start_time = `${Math.floor(sceneStart / 60)}:${(sceneStart % 60).toString().padStart(2, '0')}:00`;
                const end_time = `${Math.floor(sceneEnd / 60)}:${(sceneEnd % 60).toString().padStart(2, '0')}:00`;

                const descriptions = [
                  'Scène avec les personnages principaux',
                  'Blague post-générique',
                  'Teaser pour la suite',
                  'Scène humoristique',
                  'Setup pour le prochain film'
                ];
                let description = descriptions[Math.floor(Math.random() * descriptions.length)];

                // Sanitize description
                description = sanitizeText(description);

                await pool.query(`
                  INSERT INTO post_credit_scenes (submission_id, start_time, end_time, description, scene_order)
                  VALUES ($1, $2, $3, $4, $5)
                `, [submission_id, start_time, end_time, description, s + 1]);
              }
            }
          }

          // Add 0-3 random comments per movie
          const numComments = Math.floor(Math.random() * 4);
          const commentTexts = [
            'Les timings sont corrects, vérifié en salle.',
            'Attention, il y a une fausse fin avant le générique !',
            'Le FFEC inclut 30 secondes d\'animation avant le texte.',
            'Version VOSTFR différente de la VF, attention aux timings.',
            'Confirmé, les scènes post-crédit sont bien présentes.',
            'Le DCP que j\'ai reçu a des timings légèrement différents.',
            'Super utile, merci pour la contribution !',
            'Il manque une scène post-crédit, il y en a une après les logos finaux.'
          ];

          for (let c = 0; c < numComments; c++) {
            let commentUsername = usernames[Math.floor(Math.random() * usernames.length)];
            let comment_text = commentTexts[Math.floor(Math.random() * commentTexts.length)];

            // Sanitize comment data - username is always present
            commentUsername = sanitizeUsername(commentUsername);
            comment_text = sanitizeText(comment_text);

            await pool.query(`
              INSERT INTO comments (movie_id, username, comment_text, submitter_ip)
              VALUES ($1, $2, $3, $4)
            `, [movie_id, commentUsername, comment_text, '127.0.0.1']);
          }

          insertedCount++;
        }
      } catch (movieError) {
        logger.error(`Error inserting movie ${movie.id}:`, { error: movieError.message, stack: movieError.stack, ip: req.ip });
        console.error(`Error inserting movie ${movie.id}:`, movieError);
      }
    }

    await sendDiscordWebhook('admin', {
      title: '🎲 Données de test générées',
      color: 3066993,
      fields: [
        { name: '📊 Films', value: `${insertedCount}`, inline: true }
      ],
      timestamp: new Date().toISOString()
    });

    res.json({ message: `${insertedCount} films générés avec succès (avec versions multiples, likes, scènes post-crédit, et commentaires)` });
  } catch (error) {
    logger.error('Generate test data error:', { error: error.message, stack: error.stack, ip: req.ip });
    console.error('Generate test data error:', error);
    res.status(500).json({ error: 'Erreur lors de la génération' });
  }
});

export default router;
