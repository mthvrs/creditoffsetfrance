import React, { useState, useEffect, useRef } from 'react';
import { Box, Grid, Alert, CircularProgress, Typography, Link, Button, Card, CardContent } from '@mui/material';
import GavelIcon from '@mui/icons-material/Gavel';
import LocalMoviesIcon from '@mui/icons-material/LocalMovies';
import LanguageIcon from '@mui/icons-material/Language';
import EmailIcon from '@mui/icons-material/Email';
import LibraryBooksIcon from '@mui/icons-material/LibraryBooks';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import { FaPaypal } from 'react-icons/fa';
import MovieSearch from './MovieSearch';
import MovieSubmit from './MovieSubmit';
import MovieList from './MovieList';
import MovieDetailModal from './MovieDetailModal';
import DatabaseSearch from './DatabaseSearch';
import LegacyDataModal from './LegacyDataModal';
import axios from 'axios';

function HomePage() {
  const [movies, setMovies] = useState([]);
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [detailMovie, setDetailMovie] = useState(null);
  const [legacyModalOpen, setLegacyModalOpen] = useState(false);
  const [legacySearchQuery, setLegacySearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalMovies: 0,
    hasNextPage: false,
    hasPrevPage: false,
  });
  
  const submitFormRef = useRef(null);
  const movieListRef = useRef(null);

  useEffect(() => {
    fetchMovies();
  }, []);

  const fetchMovies = async (page = 1) => {
    try {
      setLoading(true);
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/movies?page=${page}`);
      setMovies(response.data.movies);
      setPagination(response.data.pagination);
      setError(null);
      
      // Scroll to movie list when changing pages
      if (page > 1 && movieListRef.current) {
        movieListRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } catch (err) {
      setError('Erreur lors du chargement des films');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleMovieSelect = (movie) => {
    setSelectedMovie(movie);
    setSubmitSuccess(false);
    
    setTimeout(() => {
      if (submitFormRef.current) {
        submitFormRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  const handleSubmitSuccess = async (movie_id) => {
    setSubmitSuccess(true);
    setSelectedMovie(null);
    await fetchMovies(pagination.currentPage);
    
    try {
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/movies/${movie_id}`);
      setDetailMovie(response.data);
    } catch (err) {
      console.error('Error fetching movie details:', err);
    }
    
    setTimeout(() => setSubmitSuccess(false), 5000);
  };

  const handleMovieClick = async (movie) => {
    try {
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/movies/${movie.id}`);
      setDetailMovie(response.data);
    } catch (err) {
      console.error('Error fetching movie details:', err);
    }
  };

  const handleCloseDetail = () => {
    setDetailMovie(null);
    fetchMovies(pagination.currentPage);
  };

  const handleAddVersion = (movieData) => {
    setDetailMovie(null);
    
    const movieToSelect = {
      id: movieData.tmdb_id || movieData.id,
      title: movieData.title,
      original_title: movieData.original_title,
      release_date: movieData.release_date,
      poster_path: movieData.poster_path,
      runtime: movieData.runtime,
    };
    
    handleMovieSelect(movieToSelect);
  };

  const handleOpenLegacyWithSearch = (searchQuery) => {
    setLegacySearchQuery(searchQuery);
    setLegacyModalOpen(true);
  };

  const handleCloseLegacy = () => {
    setLegacyModalOpen(false);
    setLegacySearchQuery('');
  };

  return (
    <Box sx={{ minHeight: 'calc(100vh - 200px)' }}>
      {submitSuccess && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSubmitSuccess(false)}>
          Votre soumission a été enregistrée avec succès !
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={4}>
        <Grid item xs={12} lg={5}>
          {/* 1. Database Search */}
          <DatabaseSearch 
            onMovieClick={handleMovieClick} 
            onOpenLegacy={handleOpenLegacyWithSearch}
          />
          
          {/* 2. Movie Search & Submit */}
          <MovieSearch onSelectMovie={handleMovieSelect} />
          <div ref={submitFormRef}>
            {selectedMovie && (
              <MovieSubmit movie={selectedMovie} onSuccess={handleSubmitSuccess} />
            )}
          </div>

          {/* 3. Legacy Data */}
          <Box sx={{ 
            mt: 3,
            p: 2,
            textAlign: 'center',
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: 2,
            transition: 'border-color 0.3s ease',
            '&:hover': {
              borderColor: 'rgba(242, 127, 27, 0.4)',
            },
          }}>
            <Button
              variant="text"
              size="small"
              startIcon={<LibraryBooksIcon sx={{ fontSize: '1rem' }} />}
              onClick={() => setLegacyModalOpen(true)}
              sx={{
                color: 'text.secondary',
                fontSize: '0.875rem',
                textTransform: 'none',
                '&:hover': {
                  color: 'primary.light',
                  background: 'transparent',
                },
              }}
            >
              Consulter les archives historiques
            </Button>
          </Box>
        </Grid>

        <Grid item xs={12} lg={7}>
          <div ref={movieListRef}>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                <CircularProgress size={60} />
              </Box>
            ) : (
              <>
                <MovieList movies={movies} onMovieClick={handleMovieClick} />
                
                {/* Pagination Controls */}
                {pagination.totalPages > 1 && (
                  <Card sx={{ mt: 3, background: 'rgba(255, 255, 255, 0.03)' }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
                        <Button
                          variant="outlined"
                          disabled={!pagination.hasPrevPage}
                          onClick={() => fetchMovies(pagination.currentPage - 1)}
                          startIcon={<NavigateBeforeIcon />}
                          sx={{
                            borderColor: 'primary.main',
                            color: 'primary.main',
                            '&:hover': {
                              borderColor: 'primary.light',
                              background: 'rgba(242, 127, 27, 0.1)',
                            },
                          }}
                        >
                          Précédent
                        </Button>
                        
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography variant="body1" fontWeight="600">
                            Page {pagination.currentPage} sur {pagination.totalPages}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {pagination.totalMovies} films au total
                          </Typography>
                        </Box>
                        
                        <Button
                          variant="outlined"
                          disabled={!pagination.hasNextPage}
                          onClick={() => fetchMovies(pagination.currentPage + 1)}
                          endIcon={<NavigateNextIcon />}
                          sx={{
                            borderColor: 'primary.main',
                            color: 'primary.main',
                            '&:hover': {
                              borderColor: 'primary.light',
                              background: 'rgba(242, 127, 27, 0.1)',
                            },
                          }}
                        >
                          Suivant
                        </Button>
                      </Box>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </div>
        </Grid>
      </Grid>

      {detailMovie && (
        <MovieDetailModal
          movie={detailMovie}
          open={!!detailMovie}
          onClose={handleCloseDetail}
          onAddVersion={handleAddVersion}
        />
      )}

      <LegacyDataModal
        open={legacyModalOpen}
        onClose={handleCloseLegacy}
        initialSearch={legacySearchQuery}
      />

      <Box
        component="footer"
        sx={{
          mt: 8,
          py: 4,
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          textAlign: 'center',
        }}
      >
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Informations fournies par plein de gens cools. Remerciements à la communauté de{' '}
          <Link href="http://www.projectionniste.net/" target="_blank" rel="noopener" sx={{ color: 'primary.main' }}>
            projectionniste.net
          </Link>
          , et à Cantien "gordesch" Collinet pour la première version du site !
        </Typography>
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
          <Link 
            href="https://unlicense.org/" 
            target="_blank" 
            rel="noopener" 
            sx={{ 
              color: 'primary.main',
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              textDecoration: 'none',
              '&:hover': { textDecoration: 'underline' }
            }}
          >
            <GavelIcon fontSize="small" />
            Licence Unlicense
          </Link>
          <Link 
            href="https://www.themoviedb.org/" 
            target="_blank" 
            rel="noopener" 
            sx={{ 
              color: 'primary.main',
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              textDecoration: 'none',
              '&:hover': { textDecoration: 'underline' }
            }}
          >
            <LocalMoviesIcon fontSize="small" />
            Données via TMDB
          </Link>
          <Link 
            href="https://paypal.me/MathisIvars" 
            target="_blank" 
            rel="noopener" 
            sx={{ 
              color: 'primary.main',
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              textDecoration: 'none',
              '&:hover': { textDecoration: 'underline' }
            }}
          >
            <FaPaypal size={16} />
            Contribuer à l'hébergement
          </Link>
          <Link 
            href="https://mthv.rs" 
            target="_blank" 
            rel="noopener" 
            sx={{ 
              color: 'primary.main',
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              textDecoration: 'none',
              '&:hover': { textDecoration: 'underline' }
            }}
          >
            <LanguageIcon fontSize="small" />
            mthv.rs
          </Link>
          <Link 
            href="mailto:mathis-ivars@hotmail.fr" 
            sx={{ 
              color: 'primary.main',
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              textDecoration: 'none',
              '&:hover': { textDecoration: 'underline' }
            }}
          >
            <EmailIcon fontSize="small" />
            Contact
          </Link>
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
          Problèmes, questions, commentaires, accès aux données, ... contactez-moi !
        </Typography>
      </Box>
    </Box>
  );
}

export default HomePage;
