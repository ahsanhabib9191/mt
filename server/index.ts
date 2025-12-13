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
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
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
