import express from 'express';
import authRoutes from './admin/auth.js';
import submissionsRoutes from './admin/submissions.js';
import commentsRoutes from './admin/comments.js';
import reportsRoutes from './admin/reports.js';
import ipBansRoutes from './admin/ipBans.js';
import moviesRoutes from './admin/movies.js';
import statsRoutes from './admin/stats.js';
import testDataRoutes from './admin/testData.js';

const router = express.Router();

router.use('/', authRoutes);
router.use('/', submissionsRoutes);
router.use('/', commentsRoutes);
router.use('/', reportsRoutes);
router.use('/', ipBansRoutes);
router.use('/', moviesRoutes);
router.use('/', statsRoutes);
router.use('/', testDataRoutes);

export default router;
