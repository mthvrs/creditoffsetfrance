import React from 'react';
import {
  Box,
  Card,
  Typography,
  TextField,
  Button,
  IconButton,
  Grid,
  Collapse,
  Alert,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import WarningIcon from '@mui/icons-material/Warning';

function PostCreditScenesForm({
  post_credit_scenes,
  addPostCreditScene,
  updatePostCreditScene,
  removePostCreditScene,
  checkPostCreditWarnings,
  postCreditWarnings,
}) {
  return (
    <Box sx={{ mb: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
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
                  required
                  size="small"
                  label="Début (requis)"
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
                  required
                  size="small"
                  label="Fin (requis)"
                  placeholder="1:52:30"
                  value={scene.end_time}
                  onChange={(e) => updatePostCreditScene(index, 'end_time', e.target.value)}
                  onBlur={checkPostCreditWarnings}
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
              Ce timecode semble incohérent. Vérifiez qu'il correspond bien à une scène post-crédit et qu'il n'excède pas la durée du film.
            </Alert>
          </Collapse>
        </Box>
      ))}
    </Box>
  );
}

export default PostCreditScenesForm;
