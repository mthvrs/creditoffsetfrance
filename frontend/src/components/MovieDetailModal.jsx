import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  Box,
  Typography,
  Chip,
  Divider,
  TextField,
  Button,
  Paper,
  IconButton,
  Alert,
  Card,
  CardContent,
  Grid,
  CardMedia,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Link,
  DialogTitle,
  DialogActions,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SendIcon from '@mui/icons-material/Send';
import AddIcon from '@mui/icons-material/Add';
import FlagIcon from '@mui/icons-material/Flag';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import ThumbUpOutlinedIcon from '@mui/icons-material/ThumbUpOutlined';
import ThumbDownIcon from '@mui/icons-material/ThumbDown';
import ThumbDownOutlinedIcon from '@mui/icons-material/ThumbDownOutlined';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import MovieIcon from '@mui/icons-material/Movie';
import ChatIcon from '@mui/icons-material/Chat';
import PersonIcon from '@mui/icons-material/Person';
import ScheduleIcon from '@mui/icons-material/Schedule';
import SourceIcon from '@mui/icons-material/Source';
import NoteIcon from '@mui/icons-material/Note';
import TheatersIcon from '@mui/icons-material/Theaters';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import axios from 'axios';
import { sanitizeText, sanitizeUsername, sanitizeForDisplay } from '../utils/sanitizer';

/**
 * Safely format a date string
 * @param {string} dateString - Date string from API
 * @returns {string} - Formatted date or fallback text
 */
const safeFormatDate = (dateString) => {
  if (!dateString) return '';
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return '';
    }
    return format(date, 'Pp', { locale: fr });
  } catch (e) {
    console.warn('Date formatting error:', e, dateString);
    return '';
  }
};

function MovieDetailModal({ movie, open, onClose, onAddVersion }) {
  const [commentForm, setCommentForm] = useState({ username: '', comment_text: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [commentSuccess, setCommentSuccess] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);
  const [reportMenuAnchor, setReportMenuAnchor] = useState(null);
  const [reportTarget, setReportTarget] = useState(null);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [submissions, setSubmissions] = useState([]);
  const [comments, setComments] = useState([]);
  const [reportEmail, setReportEmail] = useState('');

  useEffect(() => {
    const savedUsername = localStorage.getItem('creditoffset_username');
    if (savedUsername) {
      setCommentForm((prev) => ({ ...prev, username: savedUsername }));
    }

    if (movie && movie.submissions) {
      setSubmissions(movie.submissions || []);
      setComments(movie.comments || []);
    }
  }, [movie]);

  const handleCommentSubmit = async (e) => {
    e.preventDefault();

    if (!commentForm.username.trim() || !commentForm.comment_text.trim()) {
      setError('Nom d\'utilisateur et commentaire requis');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      localStorage.setItem('creditoffset_username', commentForm.username);

      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/movies/${movie.movie.id}/comments`,
        commentForm
      );

      // Add the new comment to the list instead of reloading
      setComments([response.data, ...comments]);
      setCommentForm({ username: commentForm.username, comment_text: '' });
      setCommentSuccess(true);

      // Hide success message after 3 seconds
      setTimeout(() => setCommentSuccess(false), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors de l\'ajout du commentaire');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVote = async (submission_id, vote_type) => {
    try {
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/movies/submissions/${submission_id}/${vote_type}`
      );

      setSubmissions((prevSubmissions) =>
        prevSubmissions.map((sub) =>
          sub.id === submission_id
            ? {
                ...sub,
                like_count: response.data.like_count,
                dislike_count: response.data.dislike_count,
                user_liked: response.data.user_vote === 'like',
                user_disliked: response.data.user_vote === 'dislike',
              }
            : sub
        )
      );
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors de l\'action');
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleCommentVote = async (comment_id, vote_type) => {
    try {
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/movies/comments/${comment_id}/${vote_type}`
      );

      setComments((prevComments) =>
        prevComments.map((comment) =>
          comment.id === comment_id
            ? {
                ...comment,
                like_count: response.data.like_count,
                dislike_count: response.data.dislike_count,
                user_liked: response.data.user_vote === 'like',
                user_disliked: response.data.user_vote === 'dislike',
              }
            : comment
        )
      );
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors de l\'action');
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleReportClick = (type, id, event) => {
    setReportTarget({ type, id });
    setReportMenuAnchor(event.currentTarget);
  };

  const handleReportSubmit = async () => {
    if (!reportReason.trim()) {
      setError('Veuillez préciser la raison du signalement');
      return;
    }

    try {
      const endpoint =
        reportTarget.type === 'submission'
          ? `movies/submissions/${reportTarget.id}/report`
          : `movies/comments/${reportTarget.id}/report`;

      await axios.post(`${process.env.REACT_APP_API_URL}/${endpoint}`, {
        reason: reportReason,
        email: reportEmail || undefined,
      });

      setReportMenuAnchor(null);
      setReportDialogOpen(false);
      setReportReason('');
      setReportEmail('');
      setReportTarget(null);
      setReportSuccess(true);

      setTimeout(() => setReportSuccess(false), 3000);
    } catch (err) {
      console.error('Report error:', err);
      console.error('Response:', err.response?.data);
      setError(err.response?.data?.error || 'Erreur lors du signalement');
    }
  };

  if (!movie || !movie.movie) {
    return null;
  }

  const movieData = movie.movie;
  const release_date = safeFormatDate(movieData.release_date);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 3, background: '#222323', maxHeight: '90vh' } }}>
      <Box sx={{ position: 'absolute', top: 16, right: 16, zIndex: 1 }}>
        <IconButton onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </Box>

      <DialogContent>
        {/* Movie Header with TMDB Link */}
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 3, mb: 4, mt: 2 }}>
          {movieData.poster_path ? (
            <CardMedia
              component="img"
              sx={{ width: 120, height: 180, borderRadius: 2, flexShrink: 0 }}
              image={`https://image.tmdb.org/t/p/w300${movieData.poster_path}`}
              alt={sanitizeText(movieData.title)}
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = `${process.env.PUBLIC_URL}/placeholder_poster.jpg`;
              }}
            />
          ) : (
            <Box
              sx={{
                width: 120,
                height: 180,
                flexShrink: 0,
                backgroundImage: `url(${process.env.PUBLIC_URL}/placeholder_poster.jpg)`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                borderRadius: 2,
              }}
            />
          )}

          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h4" fontWeight={700} gutterBottom>
              {sanitizeText(movieData.title)}
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
              {release_date && `${release_date}`}
              {release_date && movieData.runtime && ' • '}
              {movieData.runtime && `${movieData.runtime} min`}
            </Typography>
            <Tooltip title="Voir sur TMDB">
              <Button
                component={Link}
                href={`https://www.themoviedb.org/movie/${movieData.tmdb_id}`}
                target="_blank"
                rel="noopener noreferrer"
                variant="outlined"
                size="small"
                startIcon={<OpenInNewIcon />}
                sx={{ mt: 1 }}
              >
                Fiche TMDB
              </Button>
            </Tooltip>
          </Box>
        </Box>

        {commentSuccess && (
          <Alert severity="success" sx={{ mb: 2 }}>
            Commentaire ajouté avec succès !
          </Alert>
        )}

        {reportSuccess && (
          <Alert severity="success" sx={{ mb: 2 }}>
            Signalement envoyé !
          </Alert>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* Versions */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" fontWeight={600} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <MovieIcon /> Versions ({submissions.length})
          </Typography>
          <Button variant="outlined" size="small" startIcon={<AddIcon />} onClick={() => onAddVersion(movieData)}>
            Ajouter une version
          </Button>
        </Box>

        {submissions.length === 0 ? (
          <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ py: 2 }}>
            Aucune version pour l\'instant
          </Typography>
        ) : (
          submissions.map((submission) => (
            <Card key={submission.id} sx={{ mb: 2, background: 'rgba(255, 255, 255, 0.05)' }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
                  <Box sx={{ flex: 1 }}>
                    <Typography
                      variant="subtitle1"
                      fontWeight={600}
                      sx={{ wordWrap: 'break-word', wordBreak: 'break-word', overflowWrap: 'break-word' }}
                    >
                      {sanitizeText(submission.cpl_title)}
                    </Typography>
                    {submission.username && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <PersonIcon fontSize="small" />
                        Soumis par {sanitizeUsername(submission.username)}
                      </Typography>
                    )}
                  </Box>

                  <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                    {/* Like */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
                      <IconButton
                        size="small"
                        onClick={() => handleVote(submission.id, 'like')}
                        color={submission.user_liked ? 'success' : 'default'}
                      >
                        {submission.user_liked ? <ThumbUpIcon fontSize="small" /> : <ThumbUpOutlinedIcon fontSize="small" />}
                      </IconButton>
                      <Typography variant="body2" color="text.secondary" sx={{ minWidth: 20, textAlign: 'center' }}>
                        {submission.like_count || 0}
                      </Typography>
                    </Box>

                    {/* Dislike */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
                      <IconButton
                        size="small"
                        onClick={() => handleVote(submission.id, 'dislike')}
                        color={submission.user_disliked ? 'error' : 'default'}
                      >
                        {submission.user_disliked ? (
                          <ThumbDownIcon fontSize="small" />
                        ) : (
                          <ThumbDownOutlinedIcon fontSize="small" />
                        )}
                      </IconButton>
                      <Typography variant="body2" color="text.secondary" sx={{ minWidth: 20, textAlign: 'center' }}>
                        {submission.dislike_count || 0}
                      </Typography>
                    </Box>

                    {/* Report */}
                    <IconButton
                      size="small"
                      onClick={(e) => handleReportClick('submission', submission.id, e)}
                      sx={{ opacity: 0.5, '&:hover': { opacity: 1 } }}
                    >
                      <FlagIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </Box>

                <Grid container spacing={2} sx={{ mb: 2 }}>
                  {submission.ffec && (
                    <Grid item xs={6}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <ScheduleIcon fontSize="small" color="action" />
                        <Typography variant="caption" color="text.secondary">
                          Début du générique animé (FFEC)
                        </Typography>
                      </Box>
                      <Chip label={sanitizeText(submission.ffec)} size="small" color="primary" />
                      <Tooltip title="Début des crédits de fin animés (avec images, animations, logos, etc.) ou non. C'est le moment où le générique commence, même s'il est stylisé. Rappel : Il s'agit du temps écoulé depuis le début du film.">
                        <HelpOutlineIcon fontSize="small" color="action" sx={{ cursor: 'help', ml: 0.5 }} />
                      </Tooltip>
                    </Grid>
                  )}

                  {submission.ffmc && (
                    <Grid item xs={6}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <ScheduleIcon fontSize="small" color="action" />
                        <Typography variant="caption" color="text.secondary">
                          Début du générique déroulant (FFMC)
                        </Typography>
                      </Box>
                      <Chip label={sanitizeText(submission.ffmc)} size="small" color="primary" />
                      <Tooltip title="Début des crédits déroulants noirs et blancs classiques (texte simple sur fond noir, sans fioritures). C'est le générique classique qui défile. Rappel : Il s'agit du temps écoulé depuis le début du film.">
                        <HelpOutlineIcon fontSize="small" color="action" sx={{ cursor: 'help', ml: 0.5 }} />
                      </Tooltip>
                    </Grid>
                  )}
                </Grid>

                {submission.notes && (
                  <Paper sx={{ p: 1.5, mb: 2, background: 'rgba(242, 127, 27, 0.1)' }}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                      <NoteIcon fontSize="small" />
                      Notes
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{ whiteSpace: 'pre-wrap', wordWrap: 'break-word', wordBreak: 'break-word', overflowWrap: 'break-word' }}
                    >
                      {sanitizeText(submission.notes)}
                    </Typography>
                  </Paper>
                )}

                {submission.source && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <SourceIcon fontSize="small" color="action" />
                    <Typography variant="caption" color="text.secondary">
                      Source :{' '}
                      {submission.source === 'Autre'
                        ? sanitizeText(submission.source_other || submission.source)
                        : submission.source}
                    </Typography>
                  </Box>
                )}

                {/* Post-credit scenes */}
                {submission.post_credit_scenes && submission.post_credit_scenes.length > 0 && (
                  <Box sx={{ mt: 2 }}>
                    <Divider sx={{ mb: 2 }} />
                    <Typography variant="subtitle2" fontWeight={600} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                      <TheatersIcon fontSize="small" />
                      Scènes post-crédit ({submission.post_credit_scenes.length})
                    </Typography>
                    {submission.post_credit_scenes.map((scene, index) => (
                      <Paper key={scene.id} sx={{ p: 1.5, mb: 1, background: 'rgba(255, 255, 255, 0.03)' }}>
                        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 0.5 }}>
                          <Chip label={`#${index + 1}`} size="small" color="secondary" sx={{ minWidth: 40 }} />
                          <Box sx={{ display: 'flex', gap: 1 }}>
                            <Chip label={sanitizeText(scene.start_time)} size="small" variant="outlined" />
                            <Typography variant="caption" color="text.secondary">
                              →
                            </Typography>
                            <Chip label={sanitizeText(scene.end_time)} size="small" variant="outlined" />
                          </Box>
                        </Box>
                        {scene.description && (
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                            {sanitizeText(scene.description)}
                          </Typography>
                        )}
                      </Paper>
                    ))}
                  </Box>
                )}
              </CardContent>
            </Card>
          ))
        )}

        <Divider sx={{ my: 4 }} />

        {/* Comments Section */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
          <ChatIcon />
          <Typography variant="h6" fontWeight={600}>
            Commentaires ({comments.length})
          </Typography>
        </Box>

        {/* Comment Form */}
        <Card sx={{ mb: 3, background: 'rgba(255, 255, 255, 0.05)' }}>
          <CardContent>
            <form onSubmit={handleCommentSubmit}>
              <TextField
                fullWidth
                size="small"
                label="Nom d'utilisateur"
                value={commentForm.username}
                onChange={(e) => setCommentForm({ ...commentForm, username: e.target.value })}
                sx={{ mb: 2 }}
                inputProps={{ maxLength: 100 }}
              />
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Votre commentaire"
                value={commentForm.comment_text}
                onChange={(e) => setCommentForm({ ...commentForm, comment_text: e.target.value })}
                sx={{ mb: 2 }}
                inputProps={{ maxLength: 1000 }}
                helperText={`${commentForm.comment_text.length}/1000 caractères`}
              />
              <Button type="submit" variant="contained" disabled={submitting} startIcon={<SendIcon />}>
                {submitting ? 'Envoi...' : 'Envoyer'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Comments List */}
        {comments.length === 0 ? (
          <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ py: 2 }}>
            Aucun commentaire pour l'instant
          </Typography>
        ) : (
          comments.map((comment) => {
            const commentDate = safeFormatDate(comment.created_at);
            
            return (
              <Paper key={comment.id} sx={{ p: 2, mb: 2, background: 'rgba(255, 255, 255, 0.03)' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 1 }}>
                  <Box>
                    <Typography variant="subtitle2" fontWeight={600}>
                      {sanitizeUsername(comment.username)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {commentDate}
                    </Typography>
                  </Box>

                  <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                    {/* Like */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
                      <IconButton
                        size="small"
                        onClick={() => handleCommentVote(comment.id, 'like')}
                        color={comment.user_liked ? 'success' : 'default'}
                        sx={{ p: 0.5 }}
                      >
                        {comment.user_liked ? <ThumbUpIcon fontSize="small" /> : <ThumbUpOutlinedIcon fontSize="small" />}
                      </IconButton>
                      <Typography variant="caption" color="text.secondary">
                        {comment.like_count || 0}
                      </Typography>
                    </Box>

                    {/* Dislike */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
                      <IconButton
                        size="small"
                        onClick={() => handleCommentVote(comment.id, 'dislike')}
                        color={comment.user_disliked ? 'error' : 'default'}
                        sx={{ p: 0.5 }}
                      >
                        {comment.user_disliked ? <ThumbDownIcon fontSize="small" /> : <ThumbDownOutlinedIcon fontSize="small" />}
                      </IconButton>
                      <Typography variant="caption" color="text.secondary">
                        {comment.dislike_count || 0}
                      </Typography>
                    </Box>

                    {/* Report */}
                    <IconButton
                      size="small"
                      onClick={(e) => handleReportClick('comment', comment.id, e)}
                      sx={{ opacity: 0.5, '&:hover': { opacity: 1 }, p: 0.5 }}
                    >
                      <FlagIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </Box>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ wordWrap: 'break-word', wordBreak: 'break-word', overflowWrap: 'break-word', whiteSpace: 'pre-wrap' }}
                >
                  {sanitizeText(comment.comment_text)}
                </Typography>
              </Paper>
            );
          })
        )}
      </DialogContent>

      {/* Report Menu */}
      <Menu
        anchorEl={reportMenuAnchor}
        open={Boolean(reportMenuAnchor)}
        onClose={() => setReportMenuAnchor(null)}
      >
        <MenuItem
          onClick={() => {
            setReportMenuAnchor(null);
            setReportDialogOpen(true);
          }}
        >
          <ListItemIcon>
            <FlagIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Signaler ce contenu</ListItemText>
        </MenuItem>
      </Menu>

      {/* Report Dialog */}
      <Dialog open={reportDialogOpen} onClose={() => setReportDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Signaler un contenu</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            multiline
            rows={4}
            label="Raison du signalement"
            value={reportReason}
            onChange={(e) => setReportReason(e.target.value)}
            sx={{ mt: 2, mb: 2 }}
            inputProps={{ maxLength: 500 }}
            helperText={`${reportReason.length}/500 caractères`}
          />
          <TextField
            fullWidth
            label="Email (facultatif)"
            value={reportEmail}
            onChange={(e) => setReportEmail(e.target.value)}
            type="email"
            helperText="Pour un éventuel suivi"
          />
        </DialogContent>
        <DialogActions>
          <Box sx={{ display: 'flex', gap: 2, width: '100%', p: 2 }}>
            <Button
              variant="outlined"
              onClick={() => {
                setReportDialogOpen(false);
                setReportReason('');
                setReportEmail('');
              }}
              fullWidth
            >
              Annuler
            </Button>
            <Button variant="contained" onClick={handleReportSubmit} fullWidth color="error">
              Envoyer
            </Button>
          </Box>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
}

export default MovieDetailModal;
