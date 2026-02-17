import React, { useState, useEffect, useMemo } from 'react';
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
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import { sanitizeText } from '../utils/sanitizer';
import Fuse from 'fuse.js';

// Normalize accents helper
const normalizeAccents = (str) => {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
};

function LegacyDataModal({ open, onClose, initialSearch = '' }) {
  const [legacyData, setLegacyData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Pre-process data to add normalized fields for Fuse.js
  const processedLegacyData = useMemo(() => {
    return legacyData.map(movie => ({
      ...movie,
      normalizedTitle: normalizeAccents(movie.title.toLowerCase()),
    }));
  }, [legacyData]);

  // Configure Fuse.js to search on normalized fields
  const fuse = useMemo(() => {
    return new Fuse(processedLegacyData, {
      keys: [
        { name: 'normalizedTitle', weight: 1 }, // Search normalized title
        { name: 'year', weight: 0.5 }
      ],
      threshold: 0.3, // Slightly more lenient for better matching
      distance: 100,
      ignoreLocation: true,
      includeScore: true,
      minMatchCharLength: 2,
      findAllMatches: false,
      shouldSort: true,
      fieldNormWeight: 1,
    });
  }, [processedLegacyData]);

  useEffect(() => {
    if (open) {
      loadLegacyData();
      if (initialSearch) {
        setSearchQuery(initialSearch);
      }
    }
  }, [open, initialSearch]);

  useEffect(() => {
    const trimmedQuery = searchQuery.trim();
    
    if (trimmedQuery === '') {
      setFilteredData(legacyData);
    } else {
      // Normalize the search query before searching
      const normalizedQuery = normalizeAccents(trimmedQuery.toLowerCase());
      const results = fuse.search(normalizedQuery);
      
      // Custom re-sorting to prioritize exact matches and word starts
      const sortedResults = results.sort((a, b) => {
        const aTitleNorm = a.item.normalizedTitle;
        const bTitleNorm = b.item.normalizedTitle;
        
        // Priority 1: Exact match
        const aExact = aTitleNorm === normalizedQuery;
        const bExact = bTitleNorm === normalizedQuery;
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;
        
        // Priority 2: Starts with query
        const aStarts = aTitleNorm.startsWith(normalizedQuery);
        const bStarts = bTitleNorm.startsWith(normalizedQuery);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        
        // Priority 3: Contains as whole word
        const aWordBoundary = new RegExp(`\\b${normalizedQuery}`, 'i').test(aTitleNorm);
        const bWordBoundary = new RegExp(`\\b${normalizedQuery}`, 'i').test(bTitleNorm);
        if (aWordBoundary && !bWordBoundary) return -1;
        if (!aWordBoundary && bWordBoundary) return 1;
        
        // Priority 4: Fuse.js score (lower is better)
        return a.score - b.score;
      });
      
      setFilteredData(sortedResults.map(result => result.item));
    }
  }, [searchQuery, legacyData, fuse]);

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
            Si vous utilisez ces données, n'hésitez pas les recopier sur la nouvelle interface !  Note : Le COS (données historiques) correspond au temps restant tandis que le FFMC (nouvelle interface) correspond au temps écoulé.
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
                      <TableCell>{sanitizeText(movie.pre_cos || '-')}</TableCell>
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
