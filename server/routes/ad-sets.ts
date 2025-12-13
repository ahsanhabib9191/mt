import { Router, Request, Response, NextFunction } from 'express';
import { storage } from '../storage';
import { logger } from '../../lib/utils/logger';

const router = Router();

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { accountId, campaignId, status, limit = 50, offset = 0 } = req.query;

    const adSets = await storage.getAdSets(
      {
        accountId: accountId as string | undefined,
        campaignId: campaignId as string | undefined,
        status: status as string | undefined,
      },
      Number(limit),
      Number(offset)
    );

    res.json({
      data: adSets,
      pagination: {
        total: adSets.length,
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
    const adSet = await storage.getAdSet(req.params.id);
    
    if (!adSet) {
      return res.status(404).json({ error: 'Ad set not found' });
    }

    res.json({ data: adSet });
  } catch (error) {
    next(error);
  }
});

router.get('/:id/ads', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status } = req.query;
    
    const ads = await storage.getAds({
      adSetId: req.params.id,
      status: status as string | undefined,
    });

    res.json({ data: ads });
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const adSet = await storage.createAdSet(req.body);
    logger.info('Ad set created', { adSetId: adSet.adSetId });
    res.status(201).json({ data: adSet });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existingAdSet = await storage.getAdSet(req.params.id);
    
    if (!existingAdSet) {
      return res.status(404).json({ error: 'Ad set not found' });
    }

    if (existingAdSet.learningPhaseStatus === 'LEARNING' && req.body.budget) {
      return res.status(400).json({ 
        error: 'Cannot modify budget during learning phase',
        learningPhaseStatus: existingAdSet.learningPhaseStatus 
      });
    }

    const adSet = await storage.updateAdSet(req.params.id, req.body);

    logger.info('Ad set updated', { adSetId: req.params.id });
    res.json({ data: adSet });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const adSet = await storage.updateAdSet(req.params.id, { status: 'ARCHIVED' });

    if (!adSet) {
      return res.status(404).json({ error: 'Ad set not found' });
    }

    logger.info('Ad set archived', { adSetId: req.params.id });
    res.json({ data: adSet, message: 'Ad set archived successfully' });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/pause', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const adSet = await storage.updateAdSet(req.params.id, { status: 'PAUSED' });

    if (!adSet) {
      return res.status(404).json({ error: 'Ad set not found' });
    }

    logger.info('Ad set paused', { adSetId: req.params.id });
    res.json({ data: adSet });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/activate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const adSet = await storage.updateAdSet(req.params.id, { status: 'ACTIVE' });

    if (!adSet) {
      return res.status(404).json({ error: 'Ad set not found' });
    }

    logger.info('Ad set activated', { adSetId: req.params.id });
    res.json({ data: adSet });
  } catch (error) {
    next(error);
  }
});

export default router;
