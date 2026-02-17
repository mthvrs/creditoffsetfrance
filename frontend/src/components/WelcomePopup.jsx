import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  IconButton,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import InfoIcon from '@mui/icons-material/Info';

const STORAGE_KEY = 'cof_welcome_popup_seen';

const WelcomePopup = ({ forceOpen, onClose }) => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Si forceOpen est true (ouvert via la bannière), on affiche le popup
    if (forceOpen) {
      setOpen(true);
      return;
    }

    // Sinon, on vérifie le localStorage pour la première visite
    const hasSeenPopup = localStorage.getItem(STORAGE_KEY);
    if (!hasSeenPopup) {
      setOpen(true);
    }
  }, [forceOpen]);

  const handleClose = (rememberChoice = false) => {
    setOpen(false);
    if (rememberChoice) {
      localStorage.setItem(STORAGE_KEY, 'true');
    }
    if (onClose) {
      onClose();
    }
  };

  const handleForumLink = () => {
    // TODO: Remplacer par le lien du forum Projectionniste.net
    window.open('https://www.projectionniste.net/forum', '_blank');
  };

  return (
    <Dialog
      open={open}
      onClose={() => handleClose(false)}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: '#2a2b2b',
          color: '#fff',
          borderRadius: 2,
        },
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <InfoIcon sx={{ color: '#F27F1B' }} />
            <Typography variant="h6" component="span">
              Nouvelle version du site !
            </Typography>
          </Box>
          <IconButton
            onClick={() => handleClose(false)}
            sx={{ color: '#fff' }}
            size="small"
          >
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Typography variant="body1" paragraph>
          Bienvenue sur la nouvelle version améliorée de Credit Offset France !
        </Typography>
        <Typography variant="body2" paragraph sx={{ color: '#b0b0b0' }}>
          Cette version apporte de nombreuses améliorations :
        </Typography>
        <Box component="ul" sx={{ pl: 3, mb: 2, color: '#b0b0b0' }}>
          <li>
            <Typography variant="body2">Interface modernisée et plus intuitive</Typography>
          </li>
          <li>
            <Typography variant="body2">Données mises à jour en temps réel</Typography>
          </li>
          <li>
            <Typography variant="body2">Performances améliorées</Typography>
          </li>
          <li>
            <Typography variant="body2">Nouvelles fonctionnalités de recherche et filtrage</Typography>
          </li>
        </Box>
        <Typography variant="body2" sx={{ color: '#b0b0b0' }}>
          N'hésitez pas à partager vos retours sur le forum !
        </Typography>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2, flexDirection: 'column', gap: 1 }}>
        <Button
          onClick={handleForumLink}
          variant="contained"
          fullWidth
          sx={{
            bgcolor: '#F27F1B',
            '&:hover': { bgcolor: '#F2441D' },
            textTransform: 'none',
            fontWeight: 600,
          }}
        >
          Discussion sur le forum Projectionniste.net
        </Button>
        <Button
          onClick={() => handleClose(true)}
          variant="outlined"
          fullWidth
          sx={{
            color: '#fff',
            borderColor: '#555',
            '&:hover': { borderColor: '#777', bgcolor: 'rgba(255,255,255,0.05)' },
            textTransform: 'none',
          }}
        >
          Ne plus afficher à l'avenir
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default WelcomePopup;
