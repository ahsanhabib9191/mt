import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { errorHandler } from '../lib/middleware/error-handler';
import campaignRoutes from './routes/campaigns';
import adSetRoutes from './routes/ad-sets';
import adRoutes from './routes/ads';
import performanceRoutes from './routes/performance';
import authRoutes from './routes/auth';
import optimizationRoutes from './routes/optimization';
import launchRoutes from './routes/launch'; // Added import for launchRoutes
import webhookRoutes from './routes/webhooks';
import pixelRoutes from './routes/pixels';
import capiRoutes from './routes/capi';
import boostRoutes from './routes/boost';
import { pool } from './db';
import { logger } from '../lib/utils/logger';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());

const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000';
if (process.env.NODE_ENV === 'production' && corsOrigin === '*') {
  logger.warn('CORS_ORIGIN is set to "*" in production - this is insecure. Set CORS_ORIGIN to your dashboard origin or review SECURITY.md for guidance.');
}
app.use(cors({
  origin: corsOrigin,
  credentials: true,
}));
app.use(express.json());

app.get('/health', async (req, res) => {
  const dbStatus = pool ? 'connected' : 'not configured';
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: dbStatus
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/ad-sets', adSetRoutes);
app.use('/api/ads', adRoutes);
app.use('/api/performance', performanceRoutes);
app.use('/api/optimization', optimizationRoutes);
app.use('/api/pixels', pixelRoutes);
app.use('/api/capi', capiRoutes);
app.use('/api/boost', boostRoutes);
app.use('/api/launch', launchRoutes);
app.use('/webhooks', webhookRoutes);

app.use(errorHandler);

// Startup environment validation to fail fast in production if required secrets are missing
function validateRequiredEnv() {
  const required = [
    { key: 'MONGODB_URI', reason: 'MongoDB connection string is required for data storage' },
    { key: 'REDIS_URL', reason: 'Redis connection string is required for cache and rate-limiting' },
    { key: 'ENCRYPTION_KEY', reason: 'Encryption key (32 bytes, 64 hex chars) is required to encrypt sensitive data' },
    { key: 'NEXTAUTH_SECRET', reason: 'NEXTAUTH_SECRET is required for signing JWTs' },
  ];

  const missing: string[] = [];

  for (const item of required) {
    const val = process.env[item.key];
    if (!val || val.trim() === '') {
      missing.push(`${item.key}: ${item.reason}`);
    }
  }

  // ENCRYPTION_KEY additional validation: must be 64 hex chars (32 bytes)
  const enc = process.env.ENCRYPTION_KEY || '';
  if (enc && !/^[0-9a-fA-F]{64}$/.test(enc)) {
    logger.error('ENCRYPTION_KEY format invalid: expected 64 hex characters (32 bytes).');
    // Treat as missing/invalid
    missing.push('ENCRYPTION_KEY: invalid format (expected 64 hex chars)');
  }

  if (missing.length > 0) {
    logger.error('Missing or invalid required environment variables. Aborting startup.');
    missing.forEach((m) => logger.error(m));
    // Provide brief guidance
    logger.error('Copy .env.example to .env and populate required values; see DEPLOYMENT_GUIDE.md and SECURITY.md for production guidance.');
    // Exit with non-zero so orchestrators know the start failed
    process.exit(1);
  }
}

// Run validations before starting services
validateRequiredEnv();

async function startServer() {
  try {
    if (pool) {
      await pool.query('SELECT 1');
      logger.info('PostgreSQL database connected');
    } else {
      logger.warn('DATABASE_URL not set - running without database (Postgres)');
    }

    try {
      // Initialize MongoDB (Mongoose)
      const { initializeDatabase } = await import('../lib/db/index');
      await initializeDatabase();
      logger.info('MongoDB initialized');
    } catch (dbError) {
      logger.warn('Failed to initialize MongoDB, some features may be limited', { error: dbError });
    }

    app.listen(Number(PORT), '0.0.0.0', () => {
      logger.info(`Server running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

startServer();

export default app;
