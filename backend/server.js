import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { initDatabase } from './config/database.js';
import { searchLimiter } from './middleware/rateLimiter.js';
import searchRoutes from './routes/search.js';
import moviesRoutes from './routes/movies.js';
import adminRoutes from './routes/admin.js';
import statusRoutes from './routes/status.js';
import statusMonitor from './utils/tmdbStatusMonitor.js';
import logger from './utils/logger.js';

dotenv.config();

console.log('🚀 Starting server...');

const app = express();
const PORT = process.env.PORT || 3001;

// Helmet configuration with proper security headers
app.use(helmet({
  contentSecurityPolicy: false, // Configure separately if needed
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// Explicit security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// CORS configuration - Use environment variable with fallback to defaults
const allowedOrigins = process.env.CORS_ORIGIN 
  ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
  : [
      'http://localhost:3000',
      'http://localhost:5173',
      'https://creditoffset.fr',
      'https://www.creditoffset.fr'
    ];

app.use(cors({
  origin: (origin, callback) => {
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
}));

app.use(express.json());

// Trust proxy for rate limiting behind reverse proxy
app.set('trust proxy', 1);

// Routes
app.use('/api/search', searchLimiter, searchRoutes);
app.use('/api/movies', moviesRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/status', statusRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK' });
});

// Initialize database and start server
async function startServer() {
  try {
    console.log('🗄️  Initializing database...');
    await initDatabase();
    console.log('✅ Database initialized');
    
    // Start TMDB status monitoring
    statusMonitor.start();
    logger.info('TMDB status monitor started');
    
    app.listen(PORT, () => {
      console.log(`✅ Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Global error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip
  });
  
  res.status(500).json({ error: 'Erreur interne du serveur' });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception', {
    error: err.message,
    stack: err.stack
  });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { reason, promise });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  statusMonitor.stop();
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  statusMonitor.stop();
  process.exit(0);
});

startServer();
