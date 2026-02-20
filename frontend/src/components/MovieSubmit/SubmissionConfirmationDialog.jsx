import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogActions,
  Typography,
  Button,
  Box,
  Paper,
  Grid,
  Chip,
  Alert,
  CircularProgress,
  CardMedia,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import MovieIcon from '@mui/icons-material/Movie';
import PersonIcon from '@mui/icons-material/Person';
import ScheduleIcon from '@mui/icons-material/Schedule';
import NoteIcon from '@mui/icons-material/Note';
import SourceIcon from '@mui/icons-material/Source';
import TheatersIcon from '@mui/icons-material/Theaters';
import WarningIcon from '@mui/icons-material/Warning';
import { sanitizeText, sanitizeUsername } from '../../utils/sanitizer';

function SubmissionConfirmationDialog({
  open,
  onClose,
  onConfirm,
  loading,
  movie,
  formData,
  post_credit_scenes,
  timecodeWarning,
  postCreditWarnings,
  movieExists,
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          background: '#222323',
        },
      }}
    >
      <DialogContent sx={{ pt: 3 }}>
        <Typography variant="h5" fontWeight="700" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
          <CheckCircleIcon color="primary" />
          Confirmez votre soumission
        </Typography>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Veuillez vérifier que toutes les informations ci-dessous sont correctes avant de soumettre :
        </Typography>

        {/* Movie Info */}
        <Paper sx={{ p: 2, mb: 2, background: 'rgba(255, 255, 255, 0.05)' }}>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'start' }}>
            {movie.poster_path ? (
              <CardMedia
                component="img"
                sx={{ width: 60, height: 90, borderRadius: 2, flexShrink: 0 }}
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
                  width: 60,
                  height: 90,
                  flexShrink: 0,
                  backgroundImage: `url(${process.env.PUBLIC_URL}/placeholder_poster.jpg)`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  borderRadius: 2,
                }}
              />
            )}
            <Box>
              <Typography variant="subtitle1" fontWeight="600">
                {sanitizeText(movie.title)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {movie.release_date && `${new Date(movie.release_date).getFullYear()} • `}
                {movie.runtime && `${movie.runtime} min`}
              </Typography>
            </Box>
          </Box>
        </Paper>

        {/* CPL Title - SANITIZED */}
        <Paper sx={{ p: 2, mb: 2, background: 'rgba(255, 255, 255, 0.03)' }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
            <MovieIcon fontSize="small" />
            Titre CPL / Version
          </Typography>
          <Typography variant="body1" fontWeight="600">
            {sanitizeText(formData.cpl_title)}
          </Typography>
        </Paper>

        {/* Username - SANITIZED */}
        <Paper sx={{ p: 2, mb: 2, background: 'rgba(255, 255, 255, 0.03)' }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
            <PersonIcon fontSize="small" />
            Nom d'utilisateur
          </Typography>
          <Typography variant="body1">
            {sanitizeUsername(formData.username)}
          </Typography>
        </Paper>

        {/* Timecodes */}
        <Paper sx={{ p: 2, mb: 2, background: 'rgba(255, 255, 255, 0.03)' }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
            <ScheduleIcon fontSize="small" />
            Timecodes
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <Typography variant="body2" color="text.secondary">
                FFEC (Générique animé)
              </Typography>
              <Chip label={formData.ffec} color="primary" sx={{ mt: 0.5 }} />
              {(timecodeWarning.ffec || timecodeWarning.ffecLong) && (
                <Alert severity="warning" icon={<WarningIcon />} sx={{ mt: 1, fontSize: '0.75rem' }}>
                  Timecode suspect détecté
                </Alert>
              )}
            </Grid>
            <Grid item xs={6}>
              <Typography variant="body2" color="text.secondary">
                FFMC (Générique déroulant)
              </Typography>
              <Chip label={formData.ffmc} color="primary" sx={{ mt: 0.5 }} />
              {(timecodeWarning.ffmc || timecodeWarning.ffmcLong) && (
                <Alert severity="warning" icon={<WarningIcon />} sx={{ mt: 1, fontSize: '0.75rem' }}>
                  Timecode suspect détecté
                </Alert>
              )}
            </Grid>
          </Grid>
        </Paper>

        {/* Notes - SANITIZED */}
        {formData.notes && (
          <Paper sx={{ p: 2, mb: 2, background: 'rgba(242, 127, 27, 0.1)' }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
              <NoteIcon fontSize="small" />
              Notes
            </Typography>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
              {sanitizeText(formData.notes)}
            </Typography>
          </Paper>
        )}

        {/* Source - SANITIZED if Autre */}
        <Paper sx={{ p: 2, mb: 2, background: 'rgba(255, 255, 255, 0.03)' }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
            <SourceIcon fontSize="small" />
            Source de l'information
          </Typography>
          <Typography variant="body1">
            {formData.source === 'Autre' ? sanitizeText(formData.source_other) : formData.source}
          </Typography>
        </Paper>

        {/* Post-Credit Scenes - SANITIZED descriptions */}
        {post_credit_scenes.length > 0 && post_credit_scenes.some((s) => s.start_time && s.end_time) && (
          <Paper sx={{ p: 2, mb: 2, background: 'rgba(242, 68, 29, 0.1)' }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
              <TheatersIcon fontSize="small" />
              Scènes Post-Crédit ({post_credit_scenes.filter((s) => s.start_time && s.end_time).length})
            </Typography>
            {post_credit_scenes.map((scene, index) => {
              if (!scene.start_time || !scene.end_time) return null;
              return (
                <Box key={index} sx={{ mb: 1.5, '&:last-child': { mb: 0 } }}>
                  <Typography variant="body2" fontWeight="600">
                    Scène {index + 1}: {scene.start_time} → {scene.end_time}
                  </Typography>
                  {scene.description && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      {scene.description}
                    </Typography>
                  )}
                  {postCreditWarnings.includes(index) && (
                    <Alert severity="warning" icon={<WarningIcon />} sx={{ mt: 1, fontSize: '0.75rem' }}>
                      Timecode suspect détecté
                    </Alert>
                  )}
                </Box>
              );
            })}
          </Paper>
        )}

        {/* Duplicate movie warning in confirmation */}
        {movieExists && (
          <Alert severity="warning" icon={<WarningIcon />} sx={{ mb: 2 }}>
            <Typography variant="body2" fontWeight="600">
              Rappel : Ce film existe déjà dans la base. Vous ajoutez une nouvelle version.
            </Typography>
          </Alert>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button
          onClick={onClose}
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          sx={{ minWidth: 140 }}
        >
          Retour
        </Button>
        <Button
          onClick={onConfirm}
          variant="contained"
          endIcon={loading ? <CircularProgress size={20} color="inherit" /> : <CheckCircleIcon />}
          disabled={loading}
          sx={{
            minWidth: 140,
            background: 'linear-gradient(135deg, #F27F1B 0%, #F2441D 100%)',
            '&:hover': {
              background: 'linear-gradient(135deg, #F26A1B 0%, #c2410c 100%)',
            },
          }}
        >
          {loading ? 'Envoi...' : 'Confirmer'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default SubmissionConfirmationDialog;
