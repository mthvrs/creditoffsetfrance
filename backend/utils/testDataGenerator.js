import axios from 'axios';
import pool from '../config/database.js';
import logger from '../utils/logger.js';
import { sendDiscordWebhook } from '../utils/discord.js';
import { sanitizeText, sanitizeUsername } from '../utils/sanitizer.js';

export async function generateTestData(clientIp = '127.0.0.1') {
  try {
    const response = await axios.get(
      'https://api.themoviedb.org/3/movie/popular',
      {
        params: { language: 'fr-FR', region: 'FR', page: 1 },
        headers: { Authorization: `Bearer ${process.env.TMDB_BEARER_TOKEN}` }
      }
    );

    const movies = response.data.results.slice(0, 50);

    const versions = ['VOSTFR', 'VF', 'Version longue', 'EN-FR-OCAP_FR-FR_VF-XX', 'BluRay', 'DCP Standard', 'Version courte'];
    const sources = ['Observation en salle', 'Inclus dans le DCP', 'Communications du distributeur / labo'];
    const usernames = ['Alice', 'Bob', 'Charlie', 'Diana', 'TestBot', 'Projectionniste42', 'CinephileX', 'TechnicienDCP'];
    const notes = [
      'Attention, générique animé pendant 2 minutes',
      'Crédits très courts',
      'Pas de logo studio au début',
      'Version avec sous-titres forcés',
      null, null, null
    ];
    const descriptions = [
      'Scène avec les personnages principaux',
      'Blague post-générique',
      'Teaser pour la suite',
      'Scène humoristique',
      'Setup pour le prochain film'
    ];
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

    // Parallelize detailed requests
    const movieDetailsPromises = movies.map(async (movie) => {
      try {
        const detailsResponse = await axios.get(
          `https://api.themoviedb.org/3/movie/${movie.id}`,
          {
            params: { language: 'fr-FR' },
            headers: { Authorization: `Bearer ${process.env.TMDB_BEARER_TOKEN}` }
          }
        );
        return { movie, details: detailsResponse.data };
      } catch (error) {
        logger.error(`Error fetching movie ${movie.id} details:`, { error: error.message });
        return null;
      }
    });

    const moviesWithDetails = await Promise.all(movieDetailsPromises);
    const validMovies = moviesWithDetails.filter(item => item !== null);

    if (validMovies.length === 0) return 0;

    // --- Bulk Insert Movies ---
    const movieValues = [];
    const movieParams = [];
    let paramIndex = 1;

    for (const { movie, details } of validMovies) {
       const runtime = details.runtime || 120;
       movieValues.push(`($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`);
       movieParams.push(movie.id, movie.title, movie.original_title, movie.release_date, movie.poster_path, runtime);
    }

    const movieResult = await pool.query(`
      INSERT INTO movies (tmdb_id, title, original_title, release_date, poster_path, runtime)
      VALUES ${movieValues.join(', ')}
      ON CONFLICT (tmdb_id) DO NOTHING
      RETURNING id, tmdb_id, runtime
    `, movieParams);

    const insertedCount = movieResult.rows.length;
    if (insertedCount === 0) {
        // If no movies were inserted (all conflicts), we return 0 and skip child data generation
        // This matches the original logic where child data was only generated if movieResult.rows.length > 0
        return 0;
    }

    // Map tmdb_id to local DB id
    const tmdbIdMap = {};
    for (const row of movieResult.rows) {
        tmdbIdMap[row.tmdb_id] = { id: row.id, runtime: row.runtime };
    }

    // Prepare child data
    const submissionsToInsert = [];
    const commentsToInsert = [];

    // We iterate over validMovies again to maintain consistent logic with data generation
    // Only process movies that were actually inserted
    let submissionTempIdCounter = 0;

    for (const { movie } of validMovies) {
        if (!tmdbIdMap[movie.id]) continue; // Skip if not inserted (duplicate)

        const { id: movie_id, runtime } = tmdbIdMap[movie.id];

        const numVersions = Math.random() < 0.7 ? 1 : Math.random() < 0.8 ? 2 : 3;

        for (let v = 0; v < numVersions; v++) {
            const ffecMinutes = Math.floor(runtime * (0.82 + Math.random() * 0.06));
            const ffmcMinutes = Math.floor(runtime * (0.88 + Math.random() * 0.06));
            const ffec = `${Math.floor(ffecMinutes / 60)}:${(ffecMinutes % 60).toString().padStart(2, '0')}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`;
            const ffmc = `${Math.floor(ffmcMinutes / 60)}:${(ffmcMinutes % 60).toString().padStart(2, '0')}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`;

            const source = sources[Math.floor(Math.random() * sources.length)];
            const cpl_title = versions[Math.floor(Math.random() * versions.length)];
            let username = sanitizeUsername(usernames[Math.floor(Math.random() * usernames.length)]);
            let note = notes[Math.floor(Math.random() * notes.length)];
            if (note) note = sanitizeText(note);

            const submission = {
                temp_id: submissionTempIdCounter++,
                movie_id, cpl_title, ffec, ffmc, notes: note, source, submitter_ip: '127.0.0.1', username,
                likes: [],
                scenes: []
            };

            // Likes
            const numLikes = Math.floor(Math.random() * 16);
            for (let l = 0; l < numLikes; l++) {
                 const fakeIp = `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
                 submission.likes.push({ submitter_ip: fakeIp, vote_type: 'like' });
            }

            // Scenes
            if (Math.random() < 0.3) {
              const numScenes = Math.random() < 0.7 ? 1 : 2;
              for (let s = 0; s < numScenes; s++) {
                const sceneStart = Math.floor(runtime + 2 + Math.random() * 5);
                const sceneDuration = Math.floor(1 + Math.random() * 3);
                const sceneEnd = sceneStart + sceneDuration;

                const start_time = `${Math.floor(sceneStart / 60)}:${(sceneStart % 60).toString().padStart(2, '0')}:00`;
                const end_time = `${Math.floor(sceneEnd / 60)}:${(sceneEnd % 60).toString().padStart(2, '0')}:00`;
                let description = descriptions[Math.floor(Math.random() * descriptions.length)];
                description = sanitizeText(description);

                submission.scenes.push({ start_time, end_time, description, scene_order: s + 1 });
              }
            }

            submissionsToInsert.push(submission);
        }

        const numComments = Math.floor(Math.random() * 4);
        for (let c = 0; c < numComments; c++) {
            let commentUsername = sanitizeUsername(usernames[Math.floor(Math.random() * usernames.length)]);
            let comment_text = sanitizeText(commentTexts[Math.floor(Math.random() * commentTexts.length)]);
            commentsToInsert.push({ movie_id, username: commentUsername, comment_text, submitter_ip: '127.0.0.1' });
        }
    }

    // --- Bulk Insert Submissions ---
    if (submissionsToInsert.length > 0) {
        const subValues = [];
        const subParams = [];
        paramIndex = 1;

        for (const sub of submissionsToInsert) {
             subValues.push(`($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`);
             subParams.push(sub.movie_id, sub.cpl_title, sub.ffec, sub.ffmc, sub.notes, sub.source, sub.submitter_ip, sub.username);
        }

        const subResult = await pool.query(`
            INSERT INTO submissions (movie_id, cpl_title, ffec, ffmc, notes, source, submitter_ip, username)
            VALUES ${subValues.join(', ')}
            RETURNING id
        `, subParams);

        // Map returned IDs to submission objects
        // Assumption: Postgres returns rows in same order as VALUES clause
        for (let i = 0; i < subResult.rows.length; i++) {
            submissionsToInsert[i].id = subResult.rows[i].id;
        }

        // --- Bulk Insert Likes & Scenes ---
        const likesToInsert = [];
        const scenesToInsert = [];

        for (const sub of submissionsToInsert) {
            if (!sub.id) continue;
            for (const like of sub.likes) {
                likesToInsert.push({ submission_id: sub.id, ...like });
            }
            for (const scene of sub.scenes) {
                scenesToInsert.push({ submission_id: sub.id, ...scene });
            }
        }

        if (likesToInsert.length > 0) {
            const likeValues = [];
            const likeParams = [];
            paramIndex = 1;
            for (const like of likesToInsert) {
                likeValues.push(`($${paramIndex++}, $${paramIndex++}, $${paramIndex++})`);
                likeParams.push(like.submission_id, like.submitter_ip, like.vote_type);
            }

            await pool.query(`
                INSERT INTO likes (submission_id, submitter_ip, vote_type)
                VALUES ${likeValues.join(', ')}
                ON CONFLICT DO NOTHING
            `, likeParams);
        }

        if (scenesToInsert.length > 0) {
            const sceneValues = [];
            const sceneParams = [];
            paramIndex = 1;
            for (const scene of scenesToInsert) {
                sceneValues.push(`($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`);
                sceneParams.push(scene.submission_id, scene.start_time, scene.end_time, scene.description, scene.scene_order);
            }
             await pool.query(`
                INSERT INTO post_credit_scenes (submission_id, start_time, end_time, description, scene_order)
                VALUES ${sceneValues.join(', ')}
            `, sceneParams);
        }
    }

    // --- Bulk Insert Comments ---
    if (commentsToInsert.length > 0) {
        const comValues = [];
        const comParams = [];
        paramIndex = 1;
        for (const com of commentsToInsert) {
            comValues.push(`($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`);
            comParams.push(com.movie_id, com.username, com.comment_text, com.submitter_ip);
        }
        await pool.query(`
            INSERT INTO comments (movie_id, username, comment_text, submitter_ip)
            VALUES ${comValues.join(', ')}
        `, comParams);
    }

    await sendDiscordWebhook('admin', {
      title: '🎲 Données de test générées',
      color: 3066993,
      fields: [
        { name: '📊 Films', value: `${insertedCount}`, inline: true }
      ],
      timestamp: new Date().toISOString()
    });

    return insertedCount;
  } catch (error) {
    logger.error('Generate test data error:', { error: error.message, stack: error.stack, ip: clientIp });
    console.error('Generate test data error:', error);
    throw error;
  }
}
