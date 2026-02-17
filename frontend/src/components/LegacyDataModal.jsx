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

function LegacyDataModal({ open, onClose, initialSearch = '' }) {
  const [legacyData, setLegacyData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Configure Fuse.js with stricter settings and field weights
  const fuse = useMemo(() => {
    return new Fuse(legacyData, {
      keys: [
        { name: 'title', weight: 1 }, // Title is most important
        { name: 'year', weight: 0.5 } // Year is less important
      ],
      threshold: 0.2, // Strict - only minor typos and accents
      distance: 50,
      ignoreLocation: true, // Don't care where in string match occurs
      includeScore: true,
      minMatchCharLength: 2,
      // These options improve word-boundary matching
      findAllMatches: false, // Only return best match per item
      shouldSort: true, // Sort by score
      fieldNormWeight: 1, // Don't penalize short fields
    });
  }, [legacyData]);

  useEffect(() => {
    if (open) {
      loadLegacyData();
      if (initialSearch) {
        setSearchQuery(initialSearch);
      }
    }
  }, [open, initialSearch]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredData(legacyData);
    } else {
      const results = fuse.search(searchQuery);
      
      // Custom re-sorting to prioritize exact matches and word starts
      const sortedResults = results.sort((a, b) => {
        const queryLower = searchQuery.toLowerCase();
        const aTitleLower = a.item.title.toLowerCase();
        const bTitleLower = b.item.title.toLowerCase();
        
        // Remove accents for comparison
        const normalizeStr = (str) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const queryNorm = normalizeStr(queryLower);
        const aTitleNorm = normalizeStr(aTitleLower);
        const bTitleNorm = normalizeStr(bTitleLower);
        
        // Priority 1: Exact match (with or without accents)
        const aExact = aTitleNorm === queryNorm;
        const bExact = bTitleNorm === queryNorm;
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;
        
        // Priority 2: Starts with query (word boundary)
        const aStarts = aTitleNorm.startsWith(queryNorm);
        const bStarts = bTitleNorm.startsWith(queryNorm);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        
        // Priority 3: Contains as whole word
        const aWordBoundary = new RegExp(`\\b${queryNorm}`, 'i').test(aTitleNorm);
        const bWordBoundary = new RegExp(`\\b${queryNorm}`, 'i').test(bTitleNorm);
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
