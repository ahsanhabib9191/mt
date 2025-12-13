import { Router, Request, Response, NextFunction } from 'express';
import { storage } from '../storage';
import { logger } from '../../lib/utils/logger';

const router = Router();

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { accountId, adSetId, campaignId, status, limit = 50, offset = 0 } = req.query;

    const ads = await storage.getAds(
      {
        accountId: accountId as string | undefined,
        adSetId: adSetId as string | undefined,
        campaignId: campaignId as string | undefined,
        status: status as string | undefined,
      },
      Number(limit),
      Number(offset)
    );

    res.json({
      data: ads,
      pagination: {
        total: ads.length,
        limit: Number(limit),
        offset: Number(offset),
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ad = await storage.getAd(req.params.id);
    
    if (!ad) {
      return res.status(404).json({ error: 'Ad not found' });
    }

    res.json({ data: ad });
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ad = await storage.createAd(req.body);
    logger.info('Ad created', { adId: ad.adId });
    res.status(201).json({ data: ad });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ad = await storage.updateAd(req.params.id, req.body);

    if (!ad) {
      return res.status(404).json({ error: 'Ad not found' });
    }

    logger.info('Ad updated', { adId: req.params.id });
    res.json({ data: ad });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ad = await storage.updateAd(req.params.id, { status: 'ARCHIVED' });

    if (!ad) {
      return res.status(404).json({ error: 'Ad not found' });
    }

    logger.info('Ad archived', { adId: req.params.id });
    res.json({ data: ad, message: 'Ad archived successfully' });
  } catch (error) {
    next(error);
  }
});

router.post('/bulk/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { adIds, status } = req.body;

    if (!adIds || !Array.isArray(adIds) || adIds.length === 0) {
      return res.status(400).json({ error: 'adIds array is required' });
    }

    if (!['ACTIVE', 'PAUSED', 'ARCHIVED'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const modifiedCount = await storage.bulkUpdateAdStatus(adIds, status);

    logger.info('Bulk ad status update', { adIds, status, modifiedCount });
    res.json({ 
      message: 'Ads updated successfully',
      modifiedCount 
    });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/pause', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ad = await storage.updateAd(req.params.id, { status: 'PAUSED' });

    if (!ad) {
      return res.status(404).json({ error: 'Ad not found' });
    }

    logger.info('Ad paused', { adId: req.params.id });
    res.json({ data: ad });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/activate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ad = await storage.updateAd(req.params.id, { status: 'ACTIVE' });

    if (!ad) {
      return res.status(404).json({ error: 'Ad not found' });
    }

    logger.info('Ad activated', { adId: req.params.id });
    res.json({ data: ad });
  } catch (error) {
    next(error);
  }
});

export default router;
