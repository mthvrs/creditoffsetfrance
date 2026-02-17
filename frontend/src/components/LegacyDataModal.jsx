import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  Box,
  Typography,
  IconButton,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  InputAdornment,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import { sanitizeText } from '../utils/sanitizer';

function LegacyDataModal({ open, onClose }) {
  const [legacyData, setLegacyData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open) {
      loadLegacyData();
    }
  }, [open]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredData(legacyData);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = legacyData.filter(
        (movie) =>
          movie.title?.toLowerCase().includes(query) ||
          movie.year?.toString().includes(query)
      );
      setFilteredData(filtered);
    }
  }, [searchQuery, legacyData]);

  const loadLegacyData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${process.env.PUBLIC_URL}/legacy_data.json`);
      const data = await response.json();
      setLegacyData(data);
      setFilteredData(data);
    } catch (err) {
      console.error('Error loading legacy data:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 3, background: '#222323', maxHeight: '90vh' } }}>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 2 }}>
        <Typography variant="h6" fontWeight={700}>
          Archives Historiques
        </Typography>
        <IconButton onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        <Box
          sx={{
            mb: 3,
            p: 2,
            background: 'rgba(245, 158, 11, 0.1)',
            borderRadius: 2,
            border: '1px solid rgba(245, 158, 11, 0.3)',
          }}
        >
          <Typography variant="body2" color="warning.main" fontWeight={600} gutterBottom>
            Données historiques de l'ancien site
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Si vous utilisez ces données, n'hésitez pas les recopier sur la nouvelle interface ! <br />
            <br />
            Note : Le COS correspond au temps restant tandis que le FFMC correspond au temps écoulé.
          </Typography>
        </Box>

        <TextField
          fullWidth
          placeholder="Rechercher un film..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: <SearchIcon sx={{ mr: 1, color: 'action.active' }} />,
          }}
          sx={{ mb: 3 }}
        />

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <TableContainer component={Paper} sx={{ maxHeight: 500, background: 'rgba(255, 255, 255, 0.03)' }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600, background: '#1a1b1b' }}>Titre</TableCell>
                  <TableCell sx={{ fontWeight: 600, background: '#1a1b1b' }}>Année</TableCell>
                  <TableCell sx={{ fontWeight: 600, background: '#1a1b1b' }}>Pré-COS</TableCell>
                  <TableCell sx={{ fontWeight: 600, background: '#1a1b1b' }}>COS</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} align="center">
                      <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                        Aucun résultat trouvé
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredData.map((movie, index) => (
                    <TableRow key={index} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>
                          {sanitizeText(movie.title)}
                        </Typography>
                      </TableCell>
                      <TableCell>{movie.year || 'N/A'}</TableCell>
                      <TableCell>{sanitizeText(movie.precos || '-')}</TableCell>
                      <TableCell>{sanitizeText(movie.cos || '-')}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2, textAlign: 'center' }}>
          {filteredData.length} films - Archives de creditoffset.fr version gordesch
        </Typography>
      </DialogContent>
    </Dialog>
  );
}

export default LegacyDataModal;
