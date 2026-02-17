import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardMedia,
  Typography,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Grid,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  IconButton,
  Divider,
  Tooltip,
  Link,
  Collapse,
  ListItemIcon,
  ListItemText,
  Dialog,
  DialogContent,
  DialogActions,
  Paper,
  Chip,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import WarningIcon from '@mui/icons-material/Warning';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import InfoIcon from '@mui/icons-material/Info';
import MovieIcon from '@mui/icons-material/Movie';
import VisibilityIcon from '@mui/icons-material/Visibility';
import SettingsIcon from '@mui/icons-material/Settings';
import EmailIcon from '@mui/icons-material/Email';
import EditIcon from '@mui/icons-material/Edit';
import PersonIcon from '@mui/icons-material/Person';
import ScheduleIcon from '@mui/icons-material/Schedule';
import SourceIcon from '@mui/icons-material/Source';
import NoteIcon from '@mui/icons-material/Note';
import TheatersIcon from '@mui/icons-material/Theaters';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import axios from 'axios';
import { sanitizeText, sanitizeUsername } from '../utils/sanitizer';

function MovieSubmit({ movie, onSuccess }) {
  const [formData, setFormData] = useState({
    cpl_title: '',
    version: '',
    ffec: '',
    ffmc: '',
    notes: '',
    source: '',
    source_other: '',
    username: '',
  });
  const [post_credit_scenes, setPostCreditScenes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [movieExists, setMovieExists] = useState(false);
  const [cplWarning, setCplWarning] = useState(false);
  const [timecodeWarning, setTimecodeWarning] = useState({ ffec: false, ffmc: false });
  const [postCreditWarnings, setPostCreditWarnings] = useState([]);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

  useEffect(() => {
    checkMovieExists();
    const savedUsername = localStorage.getItem('creditoffset_username');
    if (savedUsername) {
      setFormData((prev) => ({ ...prev, username: savedUsername }));
    }
  }, [movie]);

  const checkMovieExists = async () => {
    try {
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/movies/check/${movie.id}`);
      setMovieExists(response.data.exists);
    } catch (err) {
      console.error('Error checking movie:', err);
    }
  };

  const validatePostCreditScenes = () => {
    if (!post_credit_scenes || !Array.isArray(post_credit_scenes)) {
      return true;
    }

    for (const scene of post_credit_scenes) {
      if (scene.start_time === '0:00:00' || scene.end_time === '0:00:00') {
        setError('Les timecodes des scènes post-crédit ne peuvent pas être 0:00:00');
        return false;
      }
    }
    return true;
  };

  const checkPostCreditWarnings = () => {
    const warnings = [];

    post_credit_scenes.forEach((scene, index) => {
      let shouldWarn = false;

      if (scene.start_time && scene.start_time !== '0:00:00') {
        const [hours, minutes] = scene.start_time.split(':').map(Number);
        const totalMinutes = hours * 60 + minutes;
        if (totalMinutes < 30) {
          shouldWarn = true;
        }
      }

      if (scene.end_time && scene.end_time !== '0:00:00') {
        const [hours, minutes] = scene.end_time.split(':').map(Number);
        const totalMinutes = hours * 60 + minutes;
        if (totalMinutes < 30) {
          shouldWarn = true;
        }
      }

      if (shouldWarn) {
        warnings.push(index);
      }
    });

    setPostCreditWarnings(warnings);
  };

  const validateTimecode = (field, value) => {
    if (!value || !movie.runtime) {
      setTimecodeWarning((prev) => ({ ...prev, [field]: false }));
      return;
    }

    const timeParts = value.split(':');
    if (timeParts.length !== 3) return;

    const hours = parseInt(timeParts[0]);
    const minutes = parseInt(timeParts[1]);
    const totalMinutes = hours * 60 + minutes;
    const movieRuntimeMinutes = movie.runtime;

    const isSuspicious = totalMinutes < movieRuntimeMinutes * 0.5;

    setTimecodeWarning((prev) => ({ ...prev, [field]: isSuspicious }));
  };

  const handleChange = (field, value) => {
    setFormData({ ...formData, [field]: value });

    if (field === 'username' && value) {
      localStorage.setItem('creditoffset_username', value);
    }
  };

  const handleBlur = (field) => {
    if (field === 'ffec' || field === 'ffmc') {
      validateTimecode(field, formData[field]);
    }
  };

  const addPostCreditScene = () => {
    if (post_credit_scenes.length >= 5) {
      setError('Maximum 5 scènes post-crédit autorisées');
      return;
    }
    setPostCreditScenes([
      ...post_credit_scenes,
      { start_time: '', end_time: '', description: '' },
    ]);
  };

  const updatePostCreditScene = (index, field, value) => {
    const updated = [...post_credit_scenes];
    
    // Sanitize description field
    if (field === 'description' && value) {
      updated[index][field] = sanitizeText(value);
    } else {
      updated[index][field] = value;
    }
    
    setPostCreditScenes(updated);
  };

  const removePostCreditScene = (index) => {
    setPostCreditScenes(post_credit_scenes.filter((_, i) => i !== index));
  };

  const validateTimeFormat = (time) => {
    if (!/^[0-9]{1,2}:[0-9]{2}:[0-9]{2}$/.test(time)) {
      return { valid: false, error: 'Format invalide. Utilisez H:MM:SS ou HH:MM:SS' };
    }

    const [hours, minutes, seconds] = time.split(':').map(Number);

    if (hours > 20) {
      return { valid: false, error: 'Les heures ne peuvent pas dépasser 20' };
    }

    if (minutes > 59) {
      return { valid: false, error: 'Les minutes doivent être entre 0 et 59' };
    }

    if (seconds > 59) {
      return { valid: false, error: 'Les secondes doivent être entre 0 et 59' };
    }

    return { valid: true };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validatePostCreditScenes()) {
      return;
    }

    if (!formData.ffec || !formData.ffmc) {
      setError('Les deux timecodes (FFEC et FFMC) sont requis. Si le film n\'a pas de générique animé, précisez le même timecode dans les deux champs.');
      return;
    }

    if (formData.ffec === '0:00:00' || formData.ffec === '00:00:00') {
      setError('Le timecode FFEC ne peut pas être 0:00:00');
      return;
    }

    if (formData.ffmc === '0:00:00' || formData.ffmc === '00:00:00') {
      setError('Le timecode FFMC ne peut pas être 0:00:00');
      return;
    }

    const ffecValidation = validateTimeFormat(formData.ffec);
    if (!ffecValidation.valid) {
      setError(`FFEC: ${ffecValidation.error}`);
      return;
    }

    const ffmcValidation = validateTimeFormat(formData.ffmc);
    if (!ffmcValidation.valid) {
      setError(`FFMC: ${ffmcValidation.error}`);
      return;
    }

    for (const scene of post_credit_scenes) {
      if (scene.start_time) {
        const startValidation = validateTimeFormat(scene.start_time);
        if (!startValidation.valid) {
          setError(`Scène post-crédit (début): ${startValidation.error}`);
          return;
        }
      }
      if (scene.end_time) {
        const endValidation = validateTimeFormat(scene.end_time);
        if (!endValidation.valid) {
          setError(`Scène post-crédit (fin): ${endValidation.error}`);
          return;
        }
      }
    }

    setConfirmDialogOpen(true);
  };

  const handleConfirmedSubmit = async () => {
    try {
      setLoading(true);
      setError(null);
      setConfirmDialogOpen(false);

      // SANITIZE ALL INPUTS BEFORE SUBMISSION
      const sanitizedData = {
        tmdb_id: movie.id,
        title: sanitizeText(movie.title),
        original_title: sanitizeText(movie.original_title || ''),
        release_date: movie.release_date,
        poster_path: movie.poster_path,
        runtime: movie.runtime,
        cpl_title: sanitizeText(formData.cpl_title),
        version: formData.version ? sanitizeText(formData.version) : null,
        ffec: formData.ffec,
        ffmc: formData.ffmc,
        notes: formData.notes ? sanitizeText(formData.notes) : null,
        source: formData.source,
        source_other: formData.source === 'Autre' ? sanitizeText(formData.source_other) : null,
        username: formData.username ? sanitizeUsername(formData.username) : null,
        post_credit_scenes: post_credit_scenes
          .filter((s) => s.start_time && s.end_time)
          .map((s, idx) => ({
            start_time: s.start_time,
            end_time: s.end_time,
            description: s.description ? sanitizeText(s.description) : null,
            scene_order: idx + 1,
          })),
      };

      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/movies`,
        sanitizedData
      );

      // Reset form
      setFormData({
        cpl_title: '',
        version: '',
        ffec: '',
        ffmc: '',
        notes: '',
        source: '',
        source_other: '',
        username: formData.username, // Keep username
      });
      setPostCreditScenes([]);
      setCplWarning(false);
      setTimecodeWarning({ ffec: false, ffmc: false });

      const movie_id = response.data.submission.movie_id;
      onSuccess(movie_id);
    } catch (err) {
      console.error('Submission error:', err);
      console.error('Response data:', err.response?.data);

      if (err.response?.data?.errors) {
        const errorMessages = err.response.data.errors.map((e) => e.msg).join(', ');
        setError(errorMessages);
      } else {
        setError(err.response?.data?.error || 'Erreur lors de la soumission');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Card sx={{ background: 'rgba(255, 255, 255, 0.03)' }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
              <MovieIcon />
              Soumettre les informations
            </Typography>
            <Tooltip title="Voir sur TMDB">
              <IconButton
                size="small"
                component={Link}
                href={`https://www.themoviedb.org/movie/${movie.id}`}
                target="_blank"
                rel="noopener noreferrer"
                sx={{ color: 'primary.main' }}
              >
                <OpenInNewIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>

          {movieExists && (
            <Alert severity="warning" icon={<WarningIcon />} sx={{ mb: 2 }}>
              Ce film existe déjà dans la base. Vous ajoutez une nouvelle version.
            </Alert>
          )}

          <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
            {movie.poster_path ? (
              <CardMedia
                component="img"
                sx={{ width: 80, height: 120, borderRadius: 2, flexShrink: 0 }}
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

          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
            <TextField
              fullWidth
              required
              label="Titre de la CPL / Version du film"
              placeholder="ex: EN-FR-OCAP, DCP 20190103, VF ressortie 4K, etc"
              value={formData.cpl_title}
              onChange={(e) => handleChange('cpl_title', e.target.value)}
              onBlur={() => handleBlur('cpl_title')}
              sx={{ mb: 1 }}
              inputProps={{ maxLength: 200 }}
            />

            <Collapse in={cplWarning}>
              <Alert severity="info" icon={<InfoIcon />} sx={{ mb: 2, mt: 1 }}>
                <Typography variant="body2" gutterBottom>
                  Ce titre ne ressemble pas à un titre CPL standard.
                </Typography>
                <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>
                  Si possible et si vous l'avez, merci de fournir le titre CPL exact !
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                  Si ce message s'affiche par erreur, ignorez-le ou signalez le problème via le lien de contact.
                </Typography>
              </Alert>
            </Collapse>

            {!cplWarning && <Box sx={{ mb: 2 }} />}

            <TextField
              fullWidth
              label="Nom d'utilisateur (facultatif)"
              placeholder="Votre pseudo"
              value={formData.username}
              onChange={(e) => handleChange('username', e.target.value)}
              sx={{ mb: 2 }}
              helperText="Sera sauvegardé pour vos futures soumissions"
              inputProps={{ maxLength: 150 }}
            />

            <Alert severity="info" icon={<InfoIcon />} sx={{ mb: 3 }}>
              <Typography variant="body2" fontWeight="600" gutterBottom>
                Important : Nouveau système de timecodes
              </Typography>
              <Typography variant="body2" sx={{ fontSize: '0.9rem' }}>
                Cette version du site utilise les <strong>timecodes absolus</strong> (temps écoulé depuis le début du DCP) et non plus les offsets (temps restant). Nous suivons désormais la norme SMPTE, car c'est ainsi que l'information est présentée dans les DCPs modernes. Par exemple, pour un film de 2h05 où les crédits commencent à 1h50, indiquez <strong>1:50:00</strong> (et non 0:15:00).
              </Typography>

              <Typography variant="body2">
                <br />
                <strong>Si le film n'a pas de générique animé</strong>, il convient alors de préciser le même timecode dans les deux champs.
              </Typography>
            </Alert>

            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  required
                  label={
                    <>
                      FFEC <Typography component="span" sx={{ fontSize: '0.75rem' }}>(Début du générique animé)</Typography>
                    </>
                  }
                  placeholder="1:43:23"
                  value={formData.ffec}
                  onChange={(e) => handleChange('ffec', e.target.value)}
                  onBlur={() => handleBlur('ffec')}
                  helperText="Format: H:MM:SS"
                  InputProps={{
                    endAdornment: (
                      <Tooltip
                        title="Début des crédits de fin animés (avec images, animations, logos, etc.) ou non. C'est le moment où le générique commence, même s'il est stylisé. Rappel : Il s'agit du temps écoulé depuis le début du film."
                        placement="top"
                      >
                        <HelpOutlineIcon fontSize="small" color="action" sx={{ cursor: 'help' }} />
                      </Tooltip>
                    ),
                  }}
                />
                <Collapse in={timecodeWarning.ffec}>
                  <Alert severity="warning" icon={<WarningIcon />} sx={{ mt: 1, fontSize: '0.85rem' }}>
                    Ce timecode semble court. Assurez-vous d'utiliser le <strong>temps écoulé</strong> depuis le début du film, et non l'offset (temps restant) qu'utilisait l'ancienne version du site.
                  </Alert>
                </Collapse>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  required
                  label={
                    <>
                      FFMC <Typography component="span" sx={{ fontSize: '0.75rem' }}>(Début du générique déroulant)</Typography>
                    </>
                  }
                  placeholder="1:45:30"
                  value={formData.ffmc}
                  onChange={(e) => handleChange('ffmc', e.target.value)}
                  onBlur={() => handleBlur('ffmc')}
                  helperText="Format: H:MM:SS"
                  InputProps={{
                    endAdornment: (
                      <Tooltip
                        title="Début des crédits déroulants noirs et blancs classiques (texte simple sur fond noir, sans fioritures). C'est le générique 'classique' qui défile. Rappel : Il s'agit du temps écoulé depuis le début du film."
                        placement="top"
                      >
                        <HelpOutlineIcon fontSize="small" color="action" sx={{ cursor: 'help' }} />
                      </Tooltip>
                    ),
                  }}
                />
                <Collapse in={timecodeWarning.ffmc}>
                  <Alert severity="warning" icon={<WarningIcon />} sx={{ mt: 1, fontSize: '0.85rem' }}>
                    Ce timecode semble court. Assurez-vous d'utiliser le <strong>temps écoulé</strong> depuis le début du film, et non l'offset (temps restant) qu'utilisait l'ancienne version du site.
                  </Alert>
                </Collapse>
              </Grid>
            </Grid>

            <TextField
              fullWidth
              multiline
              rows={3}
              label="Notes (facultatives)"
              placeholder="Informations supplémentaires, particularités de cette version..."
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              inputProps={{ maxLength: 1000 }}
              helperText={`${formData.notes.length}/1000 caractères`}
              sx={{ my: 2 }}
            />

            <FormControl fullWidth required sx={{ mb: 2 }}>
              <InputLabel>Source de l'information</InputLabel>
              <Select
                value={formData.source}
                onChange={(e) => handleChange('source', e.target.value)}
                label="Source de l'information"
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {selected === 'Observation en salle' && <VisibilityIcon fontSize="small" />}
                    {selected === 'Inclus dans le DCP' && <SettingsIcon fontSize="small" />}
                    {selected === 'Communications du distributeur / labo' && <EmailIcon fontSize="small" />}
                    {selected === 'Autre' && <EditIcon fontSize="small" />}
                    {selected}
                  </Box>
                )}
              >
                <MenuItem value="Observation en salle">
                  <ListItemIcon>
                    <VisibilityIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>Observation en salle</ListItemText>
                </MenuItem>
                <MenuItem value="Inclus dans le DCP">
                  <ListItemIcon>
                    <SettingsIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>Inclus dans le DCP</ListItemText>
                </MenuItem>
                <MenuItem value="Communications du distributeur / labo">
                  <ListItemIcon>
                    <EmailIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>Communications du distributeur / labo</ListItemText>
                </MenuItem>
                <MenuItem value="Autre">
                  <ListItemIcon>
                    <EditIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>Autre</ListItemText>
                </MenuItem>
              </Select>
            </FormControl>

            {formData.source === 'Autre' && (
              <TextField
                fullWidth
                required
                label="Précisez la source"
                value={formData.source_other}
                onChange={(e) => handleChange('source_other', e.target.value)}
                sx={{ mb: 2 }}
                inputProps={{ maxLength: 200 }}
                helperText={`${formData.source_other.length}/200 caractères`}
                InputProps={{
                  startAdornment: <EditIcon fontSize="small" sx={{ mr: 1, color: 'action.active' }} />,
                }}
              />
            )}

            <Divider sx={{ my: 3 }} />

            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="subtitle1" fontWeight="600">
                  Scènes post-crédit (facultatives)
                </Typography>
                <Button variant="outlined" size="small" startIcon={<AddIcon />} onClick={addPostCreditScene}>
                  Ajouter
                </Button>
              </Box>

              {post_credit_scenes.map((scene, index) => (
                <Box key={index}>
                  <Card sx={{ mb: 2, p: 2, background: 'rgba(242, 68, 29, 0.05)' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                      <Typography variant="body2" fontWeight="600">
                        Scène {index + 1}
                      </Typography>
                      <IconButton size="small" onClick={() => removePostCreditScene(index)} color="error">
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                    <Grid container spacing={2}>
                      <Grid item xs={6}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Début"
                          placeholder="1:50:00"
                          value={scene.start_time}
                          onChange={(e) => updatePostCreditScene(index, 'start_time', e.target.value)}
                          onBlur={checkPostCreditWarnings}
                          helperText="H:MM:SS"
                        />
                      </Grid>
                      <Grid item xs={6}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Fin"
                          placeholder="1:52:30"
                          value={scene.end_time}
                          onChange={(e) => updatePostCreditScene(index, 'end_time', e.target.value)}
                          helperText="H:MM:SS"
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Description (facultative)"
                          placeholder="Scène avec les personnages..."
                          value={scene.description}
                          onChange={(e) => updatePostCreditScene(index, 'description', e.target.value)}
                          inputProps={{ maxLength: 500 }}
                          helperText={`${scene.description?.length || 0}/500 caractères`}
                        />
                      </Grid>
                    </Grid>
                  </Card>

                  <Collapse in={postCreditWarnings.includes(index)}>
                    <Alert severity="warning" icon={<WarningIcon />} sx={{ mb: 2, fontSize: '0.85rem' }}>
                      Ce timecode semble court pour une scène post-crédit. Assurez-vous d'utiliser le <strong>temps écoulé</strong> depuis le début du film (pas le temps restant).
                    </Alert>
                  </Collapse>
                </Box>
              ))}
            </Box>

            <Button
              type="submit"
              variant="contained"
              fullWidth
              size="large"
              endIcon={loading ? <CircularProgress size={20} color="inherit" /> : <SendIcon />}
              disabled={loading}
              sx={{
                background: 'linear-gradient(135deg, #F27F1B 0%, #F2441D 100%)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #F26A1B 0%, #c2410c 100%)',
                },
              }}
            >
              {loading ? 'Envoi...' : 'Soumettre'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog
        open={confirmDialogOpen}
        onClose={() => setConfirmDialogOpen(false)}
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
          {formData.username && (
            <Paper sx={{ p: 2, mb: 2, background: 'rgba(255, 255, 255, 0.03)' }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                <PersonIcon fontSize="small" />
                Nom d'utilisateur
              </Typography>
              <Typography variant="body1">
                {sanitizeUsername(formData.username)}
              </Typography>
            </Paper>
          )}

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
                {timecodeWarning.ffec && (
                  <Alert severity="warning" icon={<WarningIcon />} sx={{ mt: 1, fontSize: '0.75rem' }}>
                    Timecode court détecté
                  </Alert>
                )}
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">
                  FFMC (Générique déroulant)
                </Typography>
                <Chip label={formData.ffmc} color="primary" sx={{ mt: 0.5 }} />
                {timecodeWarning.ffmc && (
                  <Alert severity="warning" icon={<WarningIcon />} sx={{ mt: 1, fontSize: '0.75rem' }}>
                    Timecode court détecté
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
                        {sanitizeText(scene.description)}
                      </Typography>
                    )}
                    {postCreditWarnings.includes(index) && (
                      <Alert severity="warning" icon={<WarningIcon />} sx={{ mt: 1, fontSize: '0.75rem' }}>
                        Timecode court détecté
                      </Alert>
                    )}
                  </Box>
                );
              })}
            </Paper>
          )}

          {/* CPL Warning */}
          {cplWarning && (
            <Alert severity="info" icon={<InfoIcon />} sx={{ mb: 2 }}>
              Le titre CPL ne correspond pas au format standard détecté.
            </Alert>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button
            onClick={() => setConfirmDialogOpen(false)}
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            sx={{ minWidth: 140 }}
          >
            Retour
          </Button>
          <Button
            onClick={handleConfirmedSubmit}
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
    </>
  );
}

export default MovieSubmit;
