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
          Bienvenue sur la nouvelle version de Credit Offset France !
        </Typography>
        <Typography variant="body2" paragraph sx={{ color: '#b0b0b0' }}>
          Voici une liste non exhaustive des changements :
        </Typography>
        <Box component="ul" sx={{ pl: 3, mb: 2, color: '#b0b0b0' }}>
          <li>
            <Typography variant="body2">Avant tout, pas d'inquiétude concernant les anciennes données ! Elles sont préservées dans l'onglet "Consulter les archives historiques", sous l'ancien format d'offset. Si vous les utilisez, pensez à les reporter sur la nouvelle interface ! Ce processus est délicat à automatiser et votre aide est donc la bienvenue.</Typography>
          </li>
          <li>
            <Typography variant="body2">Afin de mieux suivre la norme SMPTE, le site utilise désormais des timecodes absolus et non relatifs. Comprenez par là que l'on note le début du générique à compter du début du film et non à l'envers à compter de la fin. Ces timecodes sont déjà présents sur certains DCPs plus récents sous la forme de markers FFEC et FFMC. Ce sont donc ces termes qui sont utilisés dans l'interface.</Typography>
          </li>
          <li>
            <Typography variant="body2">Le site permet désormais d'accueillir plusieurs versions d'un même film (par exemple un DCP en VOSTFR qui serait plus long qu'en VF, ou même un BluRay !). Vous pouvez également ajouter des scènes postcrédits, utiles pour celles et ceux qui souhaitent plonger à nouveau la salle dans le noir lors de celles-ci.</Typography>
          </li>
          <li>
            <Typography variant="body2">Afin de faciliter la communication autour d'erreurs éventuelles, pour préciser certains détails, etc. le site vous permet également de laisser un petit commentaire ou de voter sur les entrées présentes sur le site.</Typography>
          </li>
          <li>
            <Typography variant="body2">Publier un film ou un commentaire est conditionné au fait d'ajouter un pseudonyme à votre publication, sans pour autant nécessiter la création d'un compte. Le but étant de ne pas rendre l'utilisation du site contraignante avec un véritable login, tout en permettant éventuellement aux contributeurs réguliers d'être reconnus. Si vous avez des retours sur ce sujet n'hésitez surtout pas, c'est une idée tout à fait experimentale et qui sera ammenée à changer. Idéalement, sauf si le site se retrouve accablé de bots, il restera sans obligation de créer un compte.</Typography>
          </li>
        </Box>
        <Typography variant="body2" sx={{ color: '#b0b0b0' }}>
          Enfin, n'hésitez pas à partager vos retours sur le forum (ou par e-mail) si vous rencontrez le moindre soucis, si vous avez des suggestions, etc !
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
