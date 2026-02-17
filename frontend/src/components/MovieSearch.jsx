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
  Container,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import InfoIcon from '@mui/icons-material/Info';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import axios from 'axios';
import { sanitizeText } from '../utils/sanitizer';

function MovieSearch({ onSelectMovie }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.length >= 2) {
        searchMovies();
      } else {
        setResults([]);
        setSearched(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [query]);

  const searchMovies = async () => {
    try {
      setLoading(true);
      setSearched(false);

      const response = await axios.get(`${process.env.REACT_APP_API_URL}/search/tmdb`, {
        params: { query },
      });

      setResults(response.data.results);
      setSearched(true);
    } catch (err) {
      console.error('Search error:', err);
      setResults([]);
      setSearched(true);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectMovie = async (movie) => {
    try {
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/search/tmdb/${movie.id}`);
      onSelectMovie(response.data);
      setQuery('');
      setResults([]);
      setSearched(false);
    } catch (err) {
      console.error('Error fetching movie details:', err);
    }
  };

  return (
    <Card sx={{ mb: 3, background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(242, 127, 27, 0.3)' }}>
      <CardContent>
        <Typography variant="h6" gutterBottom sx={{ fontWeight: 700, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          <AddCircleIcon />
          Ajouter un film
        </Typography>

        <TextField
          fullWidth
          placeholder="Rechercher sur TMDB..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          InputProps={{
            startAdornment: <SearchIcon sx={{ mr: 1, color: 'action.active' }} />,
          }}
          sx={{ mb: 2 }}
        />

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
            <CircularProgress size={32} />
          </Box>
        )}

        {searched && results.length === 0 && query.length >= 2 && !loading && (
          <Alert severity="info" icon={<InfoIcon />} sx={{ mt: 2 }}>
            <Typography variant="body2">
              Aucun résultat trouvé sur TMDB.
            </Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>
              Vous pouvez créer une page pour ce film sur{' '}
              <a href="https://www.themoviedb.org" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', fontWeight: '600' }}>
                themoviedb.org
              </a>{' '}
              avec un compte gratuit !
            </Typography>
          </Alert>
        )}

        {results.length > 0 && (
          <Paper elevation={4} sx={{ maxHeight: 400, overflow: 'auto', borderRadius: 2 }}>
            <List>
              {results.slice(0, 10).map((movie) => (
                <ListItem key={movie.id} disablePadding>
                  <ListItemButton
                    onClick={() => handleSelectMovie(movie)}
                    sx={{ display: 'flex', alignItems: 'center', width: '100%', gap: 2, py: 1 }}
                  >
                    {movie.poster_path ? (
                      <img
                        src={`https://image.tmdb.org/t/p/w92${movie.poster_path}`}
                        alt={sanitizeText(movie.title)}
                        style={{ width: 45, height: 68, borderRadius: 4, objectFit: 'cover', flexShrink: 0 }}
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = `${process.env.PUBLIC_URL}/placeholder_poster.jpg`;
                        }}
                      />
                    ) : (
                      <Box
                        sx={{
                          width: 45,
                          height: 68,
                          flexShrink: 0,
                          backgroundImage: `url(${process.env.PUBLIC_URL}/placeholder_poster.jpg)`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                          borderRadius: '4px',
                        }}
                      />
                    )}

                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body1" fontWeight={600}>
                        {sanitizeText(movie.title)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {movie.release_date ? new Date(movie.release_date).getFullYear() : 'N/A'}
                      </Typography>
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

export default MovieSearch;
