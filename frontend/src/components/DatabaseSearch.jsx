import React, { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  Card,
  CardContent,
  CardMedia,
  Typography,
  List,
  ListItem,
  ListItemButton,
  CircularProgress,
  Paper,
  Chip,
  Alert,
  InputAdornment,
  IconButton,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import InfoIcon from '@mui/icons-material/Info';
import HistoryIcon from '@mui/icons-material/History';
import ClearIcon from '@mui/icons-material/Clear';
import axios from 'axios';
import { sanitizeText } from '../utils/sanitizer';

function DatabaseSearch({ onMovieClick }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [legacyMatches, setLegacyMatches] = useState(0);

  const searchDatabase = async (searchQuery) => {
    if (searchQuery.length < 2) {
      setResults([]);
      setSearched(false);
      setLegacyMatches(0);
      return;
    }

    try {
      setLoading(true);
      setSearched(false);

      const [dbResponse] = await Promise.all([
        axios.get(`${process.env.REACT_APP_API_URL}/movies/search`, {
          params: { query: searchQuery },
        }),
      ]);

      // Check legacy data
      try {
        const legacyRes = await fetch(`${process.env.PUBLIC_URL}/legacy_data.json`);
        const legacyData = await legacyRes.json();
        const legacyResponse = legacyData.filter((movie) =>
          movie.title.toLowerCase().includes(searchQuery.toLowerCase())
        );
        setLegacyMatches(legacyResponse.length);
      } catch (err) {
        setLegacyMatches(0);
      }

      setResults(dbResponse.data);
      setSearched(true);
    } catch (err) {
      console.error('Database search error:', err);
      setResults([]);
      setLegacyMatches(0);
      setSearched(true);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (value) => {
    setQuery(value);
    const timer = setTimeout(() => {
      searchDatabase(value);
    }, 500);

    return () => clearTimeout(timer);
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setSearched(false);
    setLegacyMatches(0);
  };

  return (
    <Card sx={{ mb: 3, background: 'rgba(255, 255, 255, 0.03)', border: '2px solid rgba(242, 127, 27, 0.6)', boxShadow: '0 0 20px rgba(242, 127, 27, 0.15)' }}>
      <CardContent>
        <Typography variant="h6" gutterBottom sx={{ fontWeight: 700, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          <SearchIcon sx={{ verticalAlign: 'middle' }} />
          Rechercher dans la base
        </Typography>

        <TextField
          fullWidth
          placeholder="Rechercher un film déjà soumis..."
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          InputProps={{
            startAdornment: <SearchIcon sx={{ mr: 1, color: 'action.active' }} />,
            endAdornment: query && (
              <InputAdornment position="end">
                <IconButton size="small" onClick={handleClear}>
                  <ClearIcon />
                </IconButton>
              </InputAdornment>
            ),
          }}
          sx={{ mb: 2 }}
        />

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
            <CircularProgress size={32} />
          </Box>
        )}

        {legacyMatches > 0 && (
          <Alert severity="info" icon={<HistoryIcon />} sx={{ mb: 2 }}>
            <Typography variant="body2">
              <strong>{legacyMatches}</strong> résultats trouvés dans les archives historiques. Consultez-les également !
            </Typography>
          </Alert>
        )}

        {searched && results.length === 0 && query.length >= 2 && !loading && (
          <Alert severity="info" icon={<InfoIcon />} sx={{ mt: 2 }}>
            <Typography variant="body2" gutterBottom>
              Aucun résultat trouvé dans notre base.
            </Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>
              <strong>Vous avez ces informations ?</strong> Ajoutez-les ! Vous pouvez les trouver
            </Typography>
            <Box component="ul" sx={{ mt: 1, mb: 0, pl: 2 }}>
              <li>
                <Typography variant="body2">Dans les informations du DCP sur votre serveur</Typography>
              </li>
              <li>
                <Typography variant="body2">Dans les emails contenant les KDMs du distributeur</Typography>
              </li>
              <li>
                <Typography variant="body2">Par observation directe en salle</Typography>
              </li>
            </Box>
          </Alert>
        )}

        {!loading && results.length > 0 && (
          <Paper elevation={4} sx={{ maxHeight: 300, overflow: 'auto', borderRadius: 2 }}>
            <List>
              {results.map((movie) => (
                <ListItem key={movie.id} disablePadding>
                  <ListItemButton
                    onClick={() => onMovieClick(movie)}
                    sx={{ py: 1, display: 'flex', alignItems: 'center' }}
                  >
                    {movie.poster_path ? (
                      <CardMedia
                        component="img"
                        sx={{ width: 40, height: 60, mr: 2, borderRadius: 1 }}
                        image={`https://image.tmdb.org/t/p/w92${movie.poster_path}`}
                        alt={sanitizeText(movie.title)}
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = `${process.env.PUBLIC_URL}/placeholder_poster.jpg`;
                        }}
                      />
                    ) : (
                      <Box
                        sx={{
                          width: 40,
                          height: 60,
                          mr: 2,
                          flexShrink: 0,
                          backgroundImage: `url(${process.env.PUBLIC_URL}/placeholder_poster.jpg)`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                          borderRadius: 1,
                        }}
                      />
                    )}

                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body2" fontWeight={600}>
                        {sanitizeText(movie.title)}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 0.5 }}>
                        <Typography variant="caption" color="text.secondary">
                          {movie.release_date ? new Date(movie.release_date).getFullYear() : 'N/A'}
                        </Typography>
                        {movie.submission_count > 0 && (
                          <Chip
                            label={`${movie.submission_count} version${movie.submission_count > 1 ? 's' : ''}`}
                            size="small"
                            color="primary"
                            sx={{ height: 20 }}
                          />
                        )}
                      </Box>
                    </Box>
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          </Paper>
        )}
      </CardContent>
    </Card>
  );
}

export default DatabaseSearch;
