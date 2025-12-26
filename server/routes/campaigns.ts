import { Router, Request, Response, NextFunction } from 'express';
import { CampaignModel } from '../../lib/db/models/campaign';
import { AdSetModel } from '../../lib/db/models/ad-set';
import { AdModel } from '../../lib/db/models/ad';
import { logger } from '../../lib/utils/logger';

const router = Router();

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { accountId, limit = 50, offset = 0 } = req.query;

    if (!accountId) {
      return res.status(400).json({ error: 'accountId is required' });
    }

    const query = { accountId: accountId as string, status: { $ne: 'ARCHIVED' } };
    const total = await CampaignModel.countDocuments(query);
    const campaigns = await CampaignModel.find(query)
      .sort({ createdAt: -1 })
      .skip(Number(offset))
      .limit(Number(limit));

    res.json({
      data: campaigns,
      pagination: {
        total,
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
    const campaign = await CampaignModel.findOne({ campaignId: req.params.id });

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    res.json({ data: campaign });
  } catch (error) {
    next(error);
  }
});

router.get('/:id/ad-sets', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status } = req.query;
    const query: { campaignId: string; status?: string } = { campaignId: req.params.id };
    if (status) {
      query.status = status;
    }

    const adSets = await AdSetModel.find(query);

    res.json({ data: adSets });
  } catch (error) {
    next(error);
  }
});

router.get('/:id/ads', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status } = req.query;
    const query: { campaignId: string; status?: string } = { campaignId: req.params.id };
    if (status) {
      query.status = status;
    }

    const ads = await AdModel.find(query);

    res.json({ data: ads });
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const campaign = await CampaignModel.create(req.body);
    logger.info('Campaign created', { campaignId: campaign.campaignId });
    res.status(201).json({ data: campaign });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const campaign = await CampaignModel.findOneAndUpdate(
      { campaignId: req.params.id },
      req.body,
      { new: true }
    );

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    logger.info('Campaign updated', { campaignId: req.params.id });
    res.json({ data: campaign });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const campaign = await CampaignModel.findOneAndUpdate(
      { campaignId: req.params.id },
      { status: 'ARCHIVED' },
      { new: true }
    );

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    logger.info('Campaign archived', { campaignId: req.params.id });
    res.json({ data: campaign, message: 'Campaign archived successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;
