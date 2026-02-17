import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  IconButton,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Chip,
  Grid,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Tabs,
  Tab,
  ListItemIcon,
  ListItemText,
  InputAdornment,
  Pagination,
  Checkbox,
  TablePagination,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import BlockIcon from '@mui/icons-material/Block';
import LogoutIcon from '@mui/icons-material/Logout';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import ThumbDownIcon from '@mui/icons-material/ThumbDown';
import ScienceIcon from '@mui/icons-material/Science';
import VisibilityIcon from '@mui/icons-material/Visibility';
import SettingsIcon from '@mui/icons-material/Settings';
import EmailIcon from '@mui/icons-material/Email';
import EditNoteIcon from '@mui/icons-material/EditNote';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import FlagIcon from '@mui/icons-material/Flag';
import MovieIcon from '@mui/icons-material/Movie';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import axios from 'axios';
import { sanitizeText, sanitizeUsername } from '../../utils/sanitizer';

const safeFormatDate = (dateString) => {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    return format(date, 'Pp', { locale: fr });
  } catch (e) {
    console.warn('Date formatting error:', e);
    return '';
  }
};

function AdminDashboard() {
  const [data, setData] = useState({ submissions: [], comments: [], reports: [] });
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteMovieDialogOpen, setDeleteMovieDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [banDialogOpen, setBanDialogOpen] = useState(false);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [bulkDeleteIpDialogOpen, setBulkDeleteIpDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [banReason, setBanReason] = useState('');
  const [tabValue, setTabValue] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editForm, setEditForm] = useState({
    cpl_title: '',
    ffec: '',
    ffmc: '',
    notes: '',
    source: '',
    source_other: '',
    post_credit_scenes: [],
  });
  const [ipBans, setIpBans] = useState([]);
  const [newBanIp, setNewBanIp] = useState('');
  const [newBanReason, setNewBanReason] = useState('');
  const [bulkDeleteIds, setBulkDeleteIds] = useState([]);
  const [bulkDeleteIp, setBulkDeleteIp] = useState('');

  const [pagination, setPagination] = useState({
    submissions: { currentPage: 1, totalPages: 1, totalItems: 0 },
    comments: { currentPage: 1, totalPages: 1, totalItems: 0 },
    reports: { currentPage: 1, totalPages: 1, totalItems: 0 },
    ipBans: { currentPage: 1, totalPages: 1, totalItems: 0 },
  });

  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (!token) {
      navigate('/admin');
      return;
    }
    fetchData();
    fetchStats();
  }, [navigate]);

  useEffect(() => {
    fetchData();
  }, [
    pagination.submissions.currentPage,
    pagination.comments.currentPage,
    pagination.reports.currentPage,
    pagination.ipBans.currentPage,
  ]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('adminToken');
      const config = { headers: { Authorization: `Bearer ${token}` } };

      const [submissionsRes, commentsRes, bansRes, reportsRes] = await Promise.all([
        axios.get(`${process.env.REACT_APP_API_URL}/admin/submissions?page=${pagination.submissions.currentPage}`, config),
        axios.get(`${process.env.REACT_APP_API_URL}/admin/comments?page=${pagination.comments.currentPage}`, config),
        axios.get(`${process.env.REACT_APP_API_URL}/admin/ip-bans?page=${pagination.ipBans.currentPage}`, config),
        axios.get(`${process.env.REACT_APP_API_URL}/admin/reports?page=${pagination.reports.currentPage}`, config),
      ]);

      setData({
        submissions: submissionsRes.data.data,
        comments: commentsRes.data.data,
        reports: reportsRes.data.data,
      });

      setIpBans(bansRes.data.data);

      setPagination((prev) => ({
        ...prev,
        submissions: submissionsRes.data.pagination,
        comments: commentsRes.data.pagination,
        reports: reportsRes.data.pagination,
        ipBans: bansRes.data.pagination,
      }));

      setError(null);
    } catch (err) {
      setError('Erreur lors du chargement');
      if (err.response?.status === 401) {
        localStorage.removeItem('adminToken');
        navigate('/admin');
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (tab, page) => {
    setPagination((prev) => ({
      ...prev,
      [tab]: { ...prev[tab], currentPage: page },
    }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleTabChange = (e, newValue) => {
    setTabValue(newValue);
    setSearchQuery('');
    setBulkDeleteIds([]);
  };

  const handleAddBan = async () => {
    if (!newBanIp.trim() || !newBanReason.trim()) {
      setError('IP et raison requis');
      return;
    }

    try {
      const token = localStorage.getItem('adminToken');
      const config = { headers: { Authorization: `Bearer ${token}` } };

      await axios.post(
        `${process.env.REACT_APP_API_URL}/admin/ip-bans`,
        { ip_address: newBanIp, reason: newBanReason },
        config
      );

      setNewBanIp('');
      setNewBanReason('');
      fetchData();
    } catch (err) {
      setError('Erreur lors du bannissement');
    }
  };

  const handleRemoveBan = async (id) => {
    if (!window.confirm('Débannir cette IP ?')) return;

    try {
      const token = localStorage.getItem('adminToken');
      const config = { headers: { Authorization: `Bearer ${token}` } };

      await axios.delete(`${process.env.REACT_APP_API_URL}/admin/ip-bans/${id}`, config);
      fetchData();
    } catch (err) {
      setError('Erreur lors du débannissement');
    }
  };

  const handleDeleteReport = async (id) => {
    if (!window.confirm('Supprimer ce signalement ?')) return;

    try {
      const token = localStorage.getItem('adminToken');
      const config = { headers: { Authorization: `Bearer ${token}` } };

      await axios.delete(`${process.env.REACT_APP_API_URL}/admin/reports/${id}`, config);
      fetchData();
      fetchStats();
    } catch (err) {
      setError('Erreur lors de la suppression du signalement');
    }
  };

  const handleBulkDelete = async () => {
    if (bulkDeleteIds.length === 0) {
      setError('Aucun élément sélectionné');
      return;
    }

    if (!window.confirm(`Supprimer ${bulkDeleteIds.length} éléments de la page actuelle ?\n\nCette action est irrévérsible.`)) {
      return;
    }

    try {
      const token = localStorage.getItem('adminToken');
      const config = { headers: { Authorization: `Bearer ${token}` } };

      await Promise.all(bulkDeleteIds.map((id) => axios.delete(`${process.env.REACT_APP_API_URL}/admin/submissions/${id}`, config)));

      setBulkDeleteIds([]);
      setBulkDeleteDialogOpen(false);
      fetchData();
      fetchStats();
    } catch (err) {
      setError('Erreur lors de la suppression en groupe');
    }
  };

  const handleBulkDeleteIp = async () => {
    if (!bulkDeleteIp.trim()) {
      setError('Adresse IP requise');
      return;
    }

    if (!window.confirm(`Supprimer TOUT le contenu de l'IP ${bulkDeleteIp} ?\n\nCette action est irrévérsible et supprimera tous les soumissions, commentaires et likes.`)) {
      return;
    }

    try {
      const token = localStorage.getItem('adminToken');
      const config = { headers: { Authorization: `Bearer ${token}` } };

      await axios.post(
        `${process.env.REACT_APP_API_URL}/admin/bulk-delete-ip`,
        { ip_address: bulkDeleteIp },
        config
      );

      setBulkDeleteIp('');
      setBulkDeleteIpDialogOpen(false);
      fetchData();
      fetchStats();
      setError(null);
      alert('Contenu supprimé avec succès');
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors de la suppression en masse');
    }
  };

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const config = { headers: { Authorization: `Bearer ${token}` } };

      const response = await axios.get(`${process.env.REACT_APP_API_URL}/admin/stats`, config);
      setStats(response.data);
    } catch (err) {
      console.error('Stats error:', err);
    }
  };

  const handleDelete = async (type, id) => {
    try {
      const token = localStorage.getItem('adminToken');
      const config = { headers: { Authorization: `Bearer ${token}` } };

      const endpoint = type === 'submission' ? `admin/submissions/${id}` : `admin/comments/${id}`;

      await axios.delete(`${process.env.REACT_APP_API_URL}/${endpoint}`, config);

      setDeleteDialogOpen(false);
      setSelectedItem(null);
      fetchData();
      fetchStats();
    } catch (err) {
      setError('Erreur lors de la suppression');
    }
  };

  const handleDeleteMovie = async (movie_id) => {
    try {
      const token = localStorage.getItem('adminToken');
      const config = { headers: { Authorization: `Bearer ${token}` } };

      await axios.delete(`${process.env.REACT_APP_API_URL}/admin/movies/${movie_id}`, config);

      setDeleteMovieDialogOpen(false);
      setSelectedMovie(null);
      fetchData();
      fetchStats();
    } catch (err) {
      setError('Erreur lors de la suppression du film');
    }
  };

  const handleEditOpen = (submission) => {
    setSelectedItem(submission);
    setEditForm({
      cpl_title: submission.cpl_title,
      ffec: submission.ffec,
      ffmc: submission.ffmc,
      notes: submission.notes,
      source: submission.source,
      source_other: submission.source_other,
      post_credit_scenes: submission.post_credit_scenes || [],
    });
    setEditDialogOpen(true);
  };

  const addPostCreditScene = () => {
    setEditForm({
      ...editForm,
      post_credit_scenes: [
        ...editForm.post_credit_scenes,
        { start_time: '', end_time: '', description: '', scene_order: editForm.post_credit_scenes.length + 1 },
      ],
    });
  };

  const updatePostCreditScene = (index, field, value) => {
    const updated = [...editForm.post_credit_scenes];
    updated[index][field] = value;
    setEditForm({ ...editForm, post_credit_scenes: updated });
  };

  const removePostCreditScene = (index) => {
    const updated = editForm.post_credit_scenes.filter((_, i) => i !== index);
    updated.forEach((scene, idx) => {
      scene.scene_order = idx + 1;
    });
    setEditForm({ ...editForm, post_credit_scenes: updated });
  };

  const handleEditSubmit = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const config = { headers: { Authorization: `Bearer ${token}` } };

      await axios.put(`${process.env.REACT_APP_API_URL}/admin/submissions/${selectedItem.id}`, editForm, config);

      setEditDialogOpen(false);
      setSelectedItem(null);
      fetchData();
    } catch (err) {
      setError('Erreur lors de la modification');
    }
  };

  const handleBan = async () => {
    if (!selectedItem || !banReason.trim()) return;

    try {
      const token = localStorage.getItem('adminToken');
      const config = { headers: { Authorization: `Bearer ${token}` } };

      await axios.post(
        `${process.env.REACT_APP_API_URL}/admin/ip-bans`,
        { ip_address: selectedItem.submitter_ip, reason: banReason },
        config
      );

      setBanDialogOpen(false);
      setSelectedItem(null);
      setBanReason('');
      fetchData();
    } catch (err) {
      setError('Erreur lors du bannissement');
    }
  };

  const handleGenerateTestData = async () => {
    if (!window.confirm('Voulez-vous générer 50 films de test avec versions, commentaires et likes ?\n\nAttention : Cela peut prendre 1-2 minutes.')) {
      return;
    }

    try {
      setGenerating(true);
      setError(null);

      const token = localStorage.getItem('adminToken');
      const config = { headers: { Authorization: `Bearer ${token}` } };

      const response = await axios.post(`${process.env.REACT_APP_API_URL}/admin/generate-test-data`, {}, config);

      alert(response.data.message);
      await fetchData();
      await fetchStats();
    } catch (err) {
      setError('Erreur lors de la génération des données de test');
      console.error(err);
    } finally {
      setGenerating(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    navigate('/admin');
  };

  const getSourceIcon = (source) => {
    switch (source) {
      case 'Observation en salle':
        return <VisibilityIcon fontSize="small" />;
      case 'Inclus dans le DCP':
        return <SettingsIcon fontSize="small" />;
      case 'Communications du distributeur / labo':
        return <EmailIcon fontSize="small" />;
      case 'Autre':
        return <EditNoteIcon fontSize="small" />;
      default:
        return null;
    }
  };

  const filteredSubmissions = useMemo(() => {
    if (!searchQuery.trim()) return data.submissions;
    const query = searchQuery.toLowerCase();
    return data.submissions.filter(
      (sub) =>
        sub.title?.toLowerCase().includes(query) ||
        sub.cpl_title?.toLowerCase().includes(query) ||
        sub.username?.toLowerCase().includes(query) ||
        sub.submitter_ip?.toLowerCase().includes(query) ||
        sub.notes?.toLowerCase().includes(query)
    );
  }, [data.submissions, searchQuery]);

  const filteredComments = useMemo(() => {
    if (!searchQuery.trim()) return data.comments;
    const query = searchQuery.toLowerCase();
    return data.comments.filter(
      (comment) =>
        comment.title?.toLowerCase().includes(query) ||
        comment.username?.toLowerCase().includes(query) ||
        comment.comment_text?.toLowerCase().includes(query) ||
        comment.submitter_ip?.toLowerCase().includes(query)
    );
  }, [data.comments, searchQuery]);

  const filteredReports = useMemo(() => {
    if (!searchQuery.trim()) return data.reports;
    const query = searchQuery.toLowerCase();
    return data.reports.filter(
      (report) =>
        report.entity_data?.title?.toLowerCase().includes(query) ||
        report.entity_data?.cpl_title?.toLowerCase().includes(query) ||
        report.entity_data?.username?.toLowerCase().includes(query) ||
        report.reason?.toLowerCase().includes(query) ||
        report.email?.toLowerCase().includes(query) ||
        report.submitter_ip?.toLowerCase().includes(query)
    );
  }, [data.reports, searchQuery]);

  const filteredIPBans = useMemo(() => {
    if (!searchQuery.trim()) return ipBans;
    const query = searchQuery.toLowerCase();
    return ipBans.filter((ban) => ban.ip_address?.toLowerCase().includes(query) || ban.reason?.toLowerCase().includes(query));
  }, [ipBans, searchQuery]);

  const handleClearSearch = () => {
    setSearchQuery('');
  };

  const getPaginationInfo = (tab) => {
    const { currentPage, totalItems, itemsPerPage } = pagination[tab];
    const start = (currentPage - 1) * itemsPerPage + 1;
    const end = Math.min(currentPage * itemsPerPage, totalItems);
    return `Affichage ${start}-${end} sur ${totalItems}`;
  };

  const toggleBulkSelect = (id) => {
    setBulkDeleteIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const toggleSelectAll = () => {
    if (bulkDeleteIds.length === filteredSubmissions.length) {
      setBulkDeleteIds([]);
    } else {
      setBulkDeleteIds(filteredSubmissions.map((sub) => sub.id));
    }
  };

  if (loading) {
    return (
      <Container sx={{ py: 4, textAlign: 'center' }}>
        <Typography>Chargement...</Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Typography variant="h4" fontWeight={700}>
          Tableau de bord Admin
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="contained"
            startIcon={<ScienceIcon />}
            onClick={handleGenerateTestData}
            disabled={generating}
            sx={{
              background: 'linear-gradient(135deg, #F27F1B 0%, #F2441D 100%)',
              '&:hover': { background: 'linear-gradient(135deg, #F26A1B 0%, #c2410c 100%)' },
            }}
          >
            {generating ? 'Génération...' : 'Données de test'}
          </Button>
          <Button
            variant="outlined"
            color="error"
            startIcon={<BlockIcon />}
            onClick={() => setBulkDeleteIpDialogOpen(true)}
            title="Supprimer tout le contenu d'une IP"
          >
            Bulk Delete IP
          </Button>
          <Button variant="outlined" startIcon={<LogoutIcon />} onClick={handleLogout} color="error">
            Déconnexion
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {stats && (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={6} md={2}>
            <Card>
              <CardContent>
                <Typography variant="h4" color="primary.main" fontWeight={700}>
                  {stats.total_movies}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Films
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} md={2}>
            <Card>
              <CardContent>
                <Typography variant="h4" color="primary.main" fontWeight={700}>
                  {stats.total_submissions}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Soumissions
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} md={2}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <Typography variant="h6" color="success.main" fontWeight={700}>
                    {stats.total_likes}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    /
                  </Typography>
                  <Typography variant="h6" color="error.main" fontWeight={700}>
                    {stats.total_dislikes}
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  Likes / Dislikes
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} md={2}>
            <Card>
              <CardContent>
                <Typography variant="h4" color="primary.main" fontWeight={700}>
                  {stats.unique_contributors}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Contributeurs
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} md={2}>
            <Card>
              <CardContent>
                <Typography variant="h4" color="primary.main" fontWeight={700}>
                  {stats.total_bans}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  IPs Bannies
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} md={2}>
            <Card>
              <CardContent>
                <Typography variant="h4" color="primary.main" fontWeight={700}>
                  {stats.total_reports}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Signalements
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <TextField
            fullWidth
            placeholder="Rechercher par titre, CPL, utilisateur, IP, commentaire..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: <SearchIcon color="action" sx={{ mr: 1 }} />,
              endAdornment: searchQuery && (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={handleClearSearch}>
                    <ClearIcon />
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
          <Box sx={{ mt: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Chip label={`Soumissions ${filteredSubmissions.length}`} color={tabValue === 0 ? 'primary' : 'default'} size="small" />
            <Chip label={`Commentaires ${filteredComments.length}`} color={tabValue === 1 ? 'primary' : 'default'} size="small" />
            <Chip label={`IP Bannies ${filteredIPBans.length}`} color={tabValue === 2 ? 'primary' : 'default'} size="small" />
            <Chip label={`Signalements ${filteredReports.length}`} color={tabValue === 3 ? 'primary' : 'default'} size="small" />
            <Chip label={`Suppression groupe`} color={tabValue === 4 ? 'primary' : 'default'} size="small" />
          </Box>
        </CardContent>
      </Card>

      <Card>
        <Tabs value={tabValue} onChange={handleTabChange} sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tab label={`Soumissions (${pagination.submissions.totalItems})`} />
          <Tab label={`Commentaires (${pagination.comments.totalItems})`} />
          <Tab label={`IP Bannies (${pagination.ipBans.totalItems})`} />
          <Tab label={`Signalements (${pagination.reports.totalItems})`} />
          <Tab label="Suppression groupe" />
        </Tabs>

        {/* SUBMISSIONS TAB */}
        {tabValue === 0 && (
          <Box>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ backgroundColor: 'rgba(0, 0, 0, 0.05)' }}>
                    <TableCell>Film</TableCell>
                    <TableCell>CPL</TableCell>
                    <TableCell>FFEC</TableCell>
                    <TableCell>FFMC</TableCell>
                    <TableCell>Source</TableCell>
                    <TableCell>IP</TableCell>
                    <TableCell align="center">Votes</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredSubmissions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} align="center">
                        <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
                          {searchQuery ? 'Aucun résultat trouvé' : 'Aucune soumission'}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredSubmissions.map((sub) => (
                      <TableRow key={sub.id} hover>
                        <TableCell>
                          <Typography variant="body2" fontWeight={600}>
                            {sanitizeText(sub.title)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Box>
                            <Typography variant="body2" fontWeight={600}>
                              {sanitizeText(sub.cpl_title)}
                            </Typography>
                            {sub.username && (
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                par {sanitizeUsername(sub.username)}
                              </Typography>
                            )}
                          </Box>
                        </TableCell>
                        <TableCell>{sanitizeText(sub.ffec || '-')}</TableCell>
                        <TableCell>{sanitizeText(sub.ffmc || '-')}</TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            {getSourceIcon(sub.source)}
                            <Typography variant="caption">
                              {sub.source === 'Autre' ? sanitizeText(sub.source_other || sub.source) : sub.source}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip label={sub.submitter_ip} size="small" variant="outlined" />
                        </TableCell>
                        <TableCell align="center">
                          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', alignItems: 'center' }}>
                            <Chip icon={ThumbUpIcon} label={sub.like_count || 0} size="small" color="success" />
                            <Chip icon={ThumbDownIcon} label={sub.dislike_count || 0} size="small" color="error" />
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption">{safeFormatDate(sub.created_at)}</Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                            <IconButton size="small" onClick={() => handleEditOpen(sub)} color="primary" title="Modifier">
                              <EditIcon fontSize="small" />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={() => {
                                setSelectedItem({ type: 'submission', id: sub.id, submitter_ip: sub.submitter_ip });
                                setBanDialogOpen(true);
                              }}
                              color="warning"
                              title="Bannir l'IP"
                            >
                              <BlockIcon fontSize="small" />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={() => {
                                setSelectedItem({ type: 'submission', id: sub.id });
                                setDeleteDialogOpen(true);
                              }}
                              color="error"
                              title="Supprimer"
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2 }}>
              <Typography variant="body2" color="text.secondary">
                {getPaginationInfo('submissions')}
              </Typography>
              <Pagination
                count={pagination.submissions.totalPages}
                page={pagination.submissions.currentPage}
                onChange={(e, page) => handlePageChange('submissions', page)}
                color="primary"
                showFirstButton
                showLastButton
              />
            </Box>
          </Box>
        )}

        {/* COMMENTS TAB */}
        {tabValue === 1 && (
          <Box>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ backgroundColor: 'rgba(0, 0, 0, 0.05)' }}>
                    <TableCell>Film</TableCell>
                    <TableCell>Utilisateur</TableCell>
                    <TableCell>Commentaire</TableCell>
                    <TableCell>IP</TableCell>
                    <TableCell align="center">Votes</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredComments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} align="center">
                        <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
                          {searchQuery ? 'Aucun résultat trouvé' : 'Aucun commentaire'}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredComments.map((comment) => (
                      <TableRow key={comment.id} hover>
                        <TableCell>
                          <Typography variant="body2" fontWeight={600}>
                            {sanitizeText(comment.title)}
                          </Typography>
                        </TableCell>
                        <TableCell>{sanitizeUsername(comment.username)}</TableCell>
                        <TableCell sx={{ maxWidth: 300 }}>
                          <Typography variant="body2">{sanitizeText(comment.comment_text)}</Typography>
                        </TableCell>
                        <TableCell>
                          <Chip label={comment.submitter_ip} size="small" variant="outlined" />
                        </TableCell>
                        <TableCell align="center">
                          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                            <Chip icon={ThumbUpIcon} label={comment.like_count || 0} size="small" color="success" />
                            <Chip icon={ThumbDownIcon} label={comment.dislike_count || 0} size="small" color="error" />
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption">{safeFormatDate(comment.created_at)}</Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                            <IconButton
                              size="small"
                              onClick={() => {
                                setSelectedItem({ type: 'comment', id: comment.id, submitter_ip: comment.submitter_ip });
                                setBanDialogOpen(true);
                              }}
                              color="warning"
                              title="Bannir l'IP"
                            >
                              <BlockIcon fontSize="small" />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={() => {
                                setSelectedItem({ type: 'comment', id: comment.id });
                                setDeleteDialogOpen(true);
                              }}
                              color="error"
                              title="Supprimer"
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2 }}>
              <Typography variant="body2" color="text.secondary">
                {getPaginationInfo('comments')}
              </Typography>
              <Pagination
                count={pagination.comments.totalPages}
                page={pagination.comments.currentPage}
                onChange={(e, page) => handlePageChange('comments', page)}
                color="primary"
                showFirstButton
                showLastButton
              />
            </Box>
          </Box>
        )}

        {/* IP BANS TAB */}
        {tabValue === 2 && (
          <Box sx={{ p: 3 }}>
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Bannir une nouvelle IP
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="Adresse IP"
                    value={newBanIp}
                    onChange={(e) => setNewBanIp(e.target.value)}
                    placeholder="192.168.1.1"
                    size="small"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Raison"
                    value={newBanReason}
                    onChange={(e) => setNewBanReason(e.target.value)}
                    placeholder="Spam, abus, etc."
                    size="small"
                  />
                </Grid>
                <Grid item xs={12} md={2}>
                  <Button fullWidth variant="contained" color="error" onClick={handleAddBan} sx={{ height: '40px' }}>
                    Bannir
                  </Button>
                </Grid>
              </Grid>
            </Box>

            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ backgroundColor: 'rgba(0, 0, 0, 0.05)' }}>
                    <TableCell>Adresse IP</TableCell>
                    <TableCell>Raison</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredIPBans.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} align="center">
                        <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
                          {searchQuery ? 'Aucun résultat trouvé' : 'Aucune IP bannie'}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredIPBans.map((ban) => (
                      <TableRow key={ban.id} hover>
                        <TableCell>
                          <Chip label={ban.ip_address} color="error" size="small" />
                        </TableCell>
                        <TableCell>{sanitizeText(ban.reason)}</TableCell>
                        <TableCell>
                          <Typography variant="caption">{safeFormatDate(ban.created_at)}</Typography>
                        </TableCell>
                        <TableCell align="center">
                          <IconButton size="small" onClick={() => handleRemoveBan(ban.id)} color="success" title="Débannir">
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2 }}>
              <Typography variant="body2" color="text.secondary">
                {getPaginationInfo('ipBans')}
              </Typography>
              <Pagination
                count={pagination.ipBans.totalPages}
                page={pagination.ipBans.currentPage}
                onChange={(e, page) => handlePageChange('ipBans', page)}
                color="primary"
                showFirstButton
                showLastButton
              />
            </Box>
          </Box>
        )}

        {/* REPORTS TAB */}
        {tabValue === 3 && (
          <Box>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ backgroundColor: 'rgba(0, 0, 0, 0.05)' }}>
                    <TableCell>Type</TableCell>
                    <TableCell>Contenu signalé</TableCell>
                    <TableCell>Raison</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>IP</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredReports.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} align="center">
                        <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
                          {searchQuery ? 'Aucun résultat trouvé' : 'Aucun signalement'}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredReports.map((report) => (
                      <TableRow key={report.id} hover>
                        <TableCell>
                          <Chip 
                            label={report.entity_type === 'submission' ? 'Soumission' : 'Commentaire'} 
                            size="small" 
                            color={report.entity_type === 'submission' ? 'primary' : 'secondary'}
                          />
                        </TableCell>
                        <TableCell sx={{ maxWidth: 300 }}>
                          {report.entity_type === 'submission' ? (
                            <Box>
                              <Typography variant="body2" fontWeight={600}>
                                {sanitizeText(report.entity_data?.title)}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                CPL: {sanitizeText(report.entity_data?.cpl_title)}
                              </Typography>
                            </Box>
                          ) : (
                            <Typography variant="body2">{sanitizeText(report.entity_data?.comment_text)}</Typography>
                          )}
                        </TableCell>
                        <TableCell>{sanitizeText(report.reason)}</TableCell>
                        <TableCell>
                          <Typography variant="caption">{report.email || '-'}</Typography>
                        </TableCell>
                        <TableCell>
                          <Chip label={report.submitter_ip} size="small" variant="outlined" />
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption">{safeFormatDate(report.created_at)}</Typography>
                        </TableCell>
                        <TableCell align="center">
                          <IconButton
                            size="small"
                            onClick={() => handleDeleteReport(report.id)}
                            color="error"
                            title="Supprimer le signalement"
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2 }}>
              <Typography variant="body2" color="text.secondary">
                {getPaginationInfo('reports')}
              </Typography>
              <Pagination
                count={pagination.reports.totalPages}
                page={pagination.reports.currentPage}
                onChange={(e, page) => handlePageChange('reports', page)}
                color="primary"
                showFirstButton
                showLastButton
              />
            </Box>
          </Box>
        )}

        {/* BULK DELETE TAB */}
        {tabValue === 4 && (
          <Box sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Suppression en groupe
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Sélectionnez les soumissions à supprimer en masse dans l'onglet Soumissions.
            </Typography>
            
            <Box sx={{ mb: 3, display: 'flex', gap: 2, alignItems: 'center' }}>
              <Button
                variant="contained"
                color="primary"
                onClick={toggleSelectAll}
                disabled={filteredSubmissions.length === 0}
              >
                {bulkDeleteIds.length === filteredSubmissions.length ? 'Tout désélectionner' : 'Tout sélectionner'}
              </Button>
              <Typography variant="body2">
                {bulkDeleteIds.length} élément{bulkDeleteIds.length > 1 ? 's' : ''} sélectionné{bulkDeleteIds.length > 1 ? 's' : ''}
              </Typography>
            </Box>

            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ backgroundColor: 'rgba(0, 0, 0, 0.05)' }}>
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={bulkDeleteIds.length > 0 && bulkDeleteIds.length === filteredSubmissions.length}
                        indeterminate={bulkDeleteIds.length > 0 && bulkDeleteIds.length < filteredSubmissions.length}
                        onChange={toggleSelectAll}
                      />
                    </TableCell>
                    <TableCell>Film</TableCell>
                    <TableCell>CPL</TableCell>
                    <TableCell>Utilisateur</TableCell>
                    <TableCell>IP</TableCell>
                    <TableCell>Date</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredSubmissions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center">
                        <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
                          Aucune soumission disponible
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredSubmissions.map((sub) => (
                      <TableRow key={sub.id} hover selected={bulkDeleteIds.includes(sub.id)}>
                        <TableCell padding="checkbox">
                          <Checkbox
                            checked={bulkDeleteIds.includes(sub.id)}
                            onChange={() => toggleBulkSelect(sub.id)}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{sanitizeText(sub.title)}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{sanitizeText(sub.cpl_title)}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{sanitizeUsername(sub.username)}</Typography>
                        </TableCell>
                        <TableCell>
                          <Chip label={sub.submitter_ip} size="small" variant="outlined" />
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption">{safeFormatDate(sub.created_at)}</Typography>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                variant="contained"
                color="error"
                startIcon={<DeleteIcon />}
                onClick={handleBulkDelete}
                disabled={bulkDeleteIds.length === 0}
              >
                Supprimer {bulkDeleteIds.length} élément{bulkDeleteIds.length > 1 ? 's' : ''}
              </Button>
            </Box>
          </Box>
        )}
      </Card>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Confirmer la suppression</DialogTitle>
        <DialogContent>
          <Typography>
            Êtes-vous sûr de vouloir supprimer ce{selectedItem?.type === 'submission' ? 'tte soumission' : ' commentaire'} ?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Annuler</Button>
          <Button onClick={() => handleDelete(selectedItem?.type, selectedItem?.id)} color="error" variant="contained">
            Supprimer
          </Button>
        </DialogActions>
      </Dialog>

      {/* Ban Dialog */}
      <Dialog open={banDialogOpen} onClose={() => setBanDialogOpen(false)}>
        <DialogTitle>Bannir l'adresse IP</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }}>
            IP à bannir : <strong>{selectedItem?.submitter_ip}</strong>
          </Typography>
          <TextField
            fullWidth
            label="Raison du bannissement"
            value={banReason}
            onChange={(e) => setBanReason(e.target.value)}
            multiline
            rows={3}
            placeholder="Ex: Spam, contenu inapproprié, etc."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBanDialogOpen(false)}>Annuler</Button>
          <Button onClick={handleBan} color="error" variant="contained" disabled={!banReason.trim()}>
            Bannir
          </Button>
        </DialogActions>
      </Dialog>

      {/* Bulk Delete IP Dialog */}
      <Dialog open={bulkDeleteIpDialogOpen} onClose={() => setBulkDeleteIpDialogOpen(false)}>
        <DialogTitle>Suppression en masse par IP</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }} color="error.main">
            ⚠️ Cette action supprimera TOUT le contenu lié à cette IP (soumissions, commentaires, likes).
          </Typography>
          <TextField
            fullWidth
            label="Adresse IP"
            value={bulkDeleteIp}
            onChange={(e) => setBulkDeleteIp(e.target.value)}
            placeholder="192.168.1.1"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkDeleteIpDialogOpen(false)}>Annuler</Button>
          <Button onClick={handleBulkDeleteIp} color="error" variant="contained">
            Supprimer tout
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Modifier la soumission</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Titre CPL"
                value={editForm.cpl_title}
                onChange={(e) => setEditForm({ ...editForm, cpl_title: e.target.value })}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="FFEC"
                value={editForm.ffec}
                onChange={(e) => setEditForm({ ...editForm, ffec: e.target.value })}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="FFMC"
                value={editForm.ffmc}
                onChange={(e) => setEditForm({ ...editForm, ffmc: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Notes"
                value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                multiline
                rows={3}
              />
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Source</InputLabel>
                <Select
                  value={editForm.source}
                  label="Source"
                  onChange={(e) => setEditForm({ ...editForm, source: e.target.value })}
                >
                  <MenuItem value="Observation en salle">Observation en salle</MenuItem>
                  <MenuItem value="Inclus dans le DCP">Inclus dans le DCP</MenuItem>
                  <MenuItem value="Communications du distributeur / labo">Communications du distributeur / labo</MenuItem>
                  <MenuItem value="Autre">Autre</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            {editForm.source === 'Autre' && (
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Précisez la source"
                  value={editForm.source_other}
                  onChange={(e) => setEditForm({ ...editForm, source_other: e.target.value })}
                />
              </Grid>
            )}
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">Scènes post-générique</Typography>
                <Button startIcon={<AddIcon />} onClick={addPostCreditScene} size="small">
                  Ajouter une scène
                </Button>
              </Box>
              {editForm.post_credit_scenes.map((scene, index) => (
                <Card key={index} sx={{ mb: 2, p: 2 }}>
                  <Grid container spacing={2}>
                    <Grid item xs={4}>
                      <TextField
                        fullWidth
                        label="Début"
                        value={scene.start_time}
                        onChange={(e) => updatePostCreditScene(index, 'start_time', e.target.value)}
                        placeholder="HH:MM:SS:FF"
                      />
                    </Grid>
                    <Grid item xs={4}>
                      <TextField
                        fullWidth
                        label="Fin"
                        value={scene.end_time}
                        onChange={(e) => updatePostCreditScene(index, 'end_time', e.target.value)}
                        placeholder="HH:MM:SS:FF"
                      />
                    </Grid>
                    <Grid item xs={4}>
                      <Button
                        fullWidth
                        variant="outlined"
                        color="error"
                        onClick={() => removePostCreditScene(index)}
                        sx={{ height: '56px' }}
                      >
                        Supprimer
                      </Button>
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label="Description"
                        value={scene.description}
                        onChange={(e) => updatePostCreditScene(index, 'description', e.target.value)}
                        multiline
                        rows={2}
                      />
                    </Grid>
                  </Grid>
                </Card>
              ))}
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Annuler</Button>
          <Button onClick={handleEditSubmit} variant="contained" color="primary">
            Enregistrer
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

export default AdminDashboard;