import React from 'react';
import {
  Box,
  Card,
  CardContent,
  CardMedia,
  Typography,
  Chip,
  Paper,
  Button,
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import MovieFilterIcon from '@mui/icons-material/MovieFilter';
import MovieIcon from '@mui/icons-material/Movie';
import TheatersIcon from '@mui/icons-material/Theaters';
import { sanitizeText } from '../utils/sanitizer';

function MovieList({ movies, onMovieClick }) {
  if (!movies || movies.length === 0) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center', background: 'rgba(255, 255, 255, 0.03)' }}>
        <MovieIcon sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
        <Typography color="text.secondary" variant="h6">
          Aucun film enregistré pour le moment
        </Typography>
        <Typography color="text.secondary" variant="body2" sx={{ mt: 1 }}>
          Soyez le premier à contribuer !
        </Typography>
      </Paper>
    );
  }

  const renderSubmissionInfo = (movie) => {
    if (!movie.submissions || movie.submissions.length === 0) {
      return null;
    }

    if (movie.submissions.length > 1) {
      return (
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
          <Chip
            label={`${movie.submissions.length} versions - consulter le détail`}
            size="small"
            color="primary"
            icon={<MovieFilterIcon />}
          />
        </Box>
      );
    }

    const submission = movie.submissions[0];
    const hasPostCredits = submission.post_credit_scenes && submission.post_credit_scenes.length > 0;

    return (
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
        <Chip label={sanitizeText(submission.cpl_title)} size="small" color="primary" />
        {submission.ffec && <Chip label={`FFEC: ${submission.ffec}`} size="small" variant="outlined" />}
        {submission.ffmc && <Chip label={`FFMC: ${submission.ffmc}`} size="small" variant="outlined" />}
        {hasPostCredits && (
          <Chip
            label="Contient des scènes post-crédit"
            size="small"
            color="secondary"
            variant="outlined"
            icon={TheatersIcon}
          />
        )}
      </Box>
    );
  };

  return (
    <Box sx={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: 2, p: 3 }}>
      <Typography
        variant="h6"
        gutterBottom
        sx={{ fontWeight: 700, mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}
      >
        <MovieIcon />
        Derniers ajouts
      </Typography>

      <Box sx={{ maxHeight: '75vh', overflow: 'auto', pr: 1 }}>
        {movies.map((movie) => (
          <Card
            key={movie.id}
            sx={{
              mb: 2,
              display: 'flex',
              background: 'rgba(255, 255, 255, 0.03)',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: '0 12px 24px -8px rgba(242, 127, 27, 0.4)',
              },
            }}
            onClick={() => onMovieClick(movie)}
          >
            {movie.poster_path ? (
              <CardMedia
                component="img"
                sx={{ width: 80, height: 120, flexShrink: 0, borderRadius: 1 }}
                image={`https://image.tmdb.org/t/p/w200${movie.poster_path}`}
                alt={sanitizeText(movie.title)}
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = `${process.env.PUBLIC_URL}/placeholder_poster.jpg`;
                }}
              />
            ) : (
              <Box
                sx={{
                  width: 80,
                  height: 120,
                  flexShrink: 0,
                  backgroundImage: `url(${process.env.PUBLIC_URL}/placeholder_poster.jpg)`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  borderRadius: 1,
                }}
              />
            )}

            <CardContent sx={{ flex: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="h6" component="div" sx={{ fontSize: '1rem', fontWeight: 600, mb: 0.5 }}>
                    {sanitizeText(movie.title)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    {movie.release_date ? `${new Date(movie.release_date).getFullYear()}` : 'N/A'}
                    {movie.runtime && ` • ${movie.runtime} min`}
                  </Typography>
                  {renderSubmissionInfo(movie)}
                </Box>

                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<VisibilityIcon />}
                  onClick={(e) => {
                    e.stopPropagation();
                    onMovieClick(movie);
                  }}
                >
                  Voir
                </Button>
              </Box>
            </CardContent>
          </Card>
        ))}
      </Box>
    </Box>
  );
}

export default MovieList;
