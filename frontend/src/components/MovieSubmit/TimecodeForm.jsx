import React from 'react';
import {
  Grid,
  TextField,
  Typography,
  Tooltip,
  Collapse,
  Alert,
} from '@mui/material';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import WarningIcon from '@mui/icons-material/Warning';

function TimecodeForm({ formData, handleChange, handleBlur, timecodeWarning, movie }) {
  return (
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
        <Collapse in={timecodeWarning.ffecLong}>
          <Alert severity="warning" icon={<WarningIcon />} sx={{ mt: 1, fontSize: '0.85rem' }}>
            Ce timecode dépasse la durée du film ({movie.runtime} min). Vérifiez qu'il n'y a pas d'erreur.
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
        <Collapse in={timecodeWarning.ffmcLong}>
          <Alert severity="warning" icon={<WarningIcon />} sx={{ mt: 1, fontSize: '0.85rem' }}>
            Ce timecode dépasse la durée du film ({movie.runtime} min). Vérifiez qu'il n'y a pas d'erreur.
          </Alert>
        </Collapse>
      </Grid>
    </Grid>
  );
}

export default TimecodeForm;
