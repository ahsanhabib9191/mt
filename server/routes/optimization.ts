import { Router, Request, Response, NextFunction } from 'express';
import { AdSetModel } from '../../lib/db/models/ad-set';
import { AdModel } from '../../lib/db/models/ad';
import { PerformanceSnapshotModel } from '../../lib/db/models/performance-snapshot';
import { OptimizationLogModel } from '../../lib/db/models/optimization-log';
import { logger } from '../../lib/utils/logger';

const router = Router();

interface OptimizationRecommendation {
  entityType: 'AD_SET' | 'AD';
  entityId: string;
  entityName: string;
  action: 'PAUSE' | 'SCALE' | 'REDUCE_BUDGET' | 'MONITOR';
  reason: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  metrics: {
    spend: number;
    conversions: number;
    roas: number;
    cpa: number;
    ctr: number;
  };
}

// 1. Get Recommendations (Mongoose Implementation)
router.get('/recommendations', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { accountId } = req.query;

    const query: any = { status: 'ACTIVE' };
    if (accountId) query.accountId = accountId;

    const activeAdSets = await AdSetModel.find(query);
    const recommendations: OptimizationRecommendation[] = [];

    const last7Days = new Date();
    last7Days.setDate(last7Days.getDate() - 7);

    for (const adSet of activeAdSets) {
      // Aggregation for performance metrics
      const perfStats = await PerformanceSnapshotModel.aggregate([
        {
          $match: {
            entityType: 'AD_SET',
            entityId: adSet.adSetId,
            date: { $gte: last7Days }
          }
        },
        {
          $group: {
            _id: null,
            spend: { $sum: '$spend' },
            impressions: { $sum: '$impressions' },
            clicks: { $sum: '$clicks' },
            conversions: { $sum: '$conversions' },
            revenue: { $sum: '$revenue' }
          }
        }
      ]);

      const metrics = perfStats[0] || { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 };

      const ctr = metrics.impressions > 0 ? (metrics.clicks / metrics.impressions * 100) : 0;
      const cpa = metrics.conversions > 0 ? (metrics.spend / metrics.conversions) : 0;
      const roas = metrics.spend > 0 ? (metrics.revenue / metrics.spend) : 0;

      if (adSet.learningPhaseStatus === 'LEARNING') {
        recommendations.push({
          entityType: 'AD_SET',
          entityId: adSet.adSetId,
          entityName: adSet.name,
          action: 'MONITOR',
          reason: 'Ad set is in learning phase - avoid making changes',
          priority: 'LOW',
          metrics: { spend: metrics.spend, conversions: metrics.conversions, roas, cpa, ctr },
        });
        continue;
      }

      if (metrics.conversions >= 10) {
        if (cpa > 50 && roas < 1) {
          recommendations.push({
            entityType: 'AD_SET',
            entityId: adSet.adSetId,
            entityName: adSet.name,
            action: 'PAUSE',
            reason: `High CPA ($${cpa.toFixed(2)}) and low ROAS (${roas.toFixed(2)}x) - consider pausing`,
            priority: 'HIGH',
            metrics: { spend: metrics.spend, conversions: metrics.conversions, roas, cpa, ctr },
          });
        } else if (roas > 3) {
          recommendations.push({
            entityType: 'AD_SET',
            entityId: adSet.adSetId,
            entityName: adSet.name,
            action: 'SCALE',
            reason: `Strong ROAS (${roas.toFixed(2)}x) - consider increasing budget by 20%`,
            priority: 'MEDIUM',
            metrics: { spend: metrics.spend, conversions: metrics.conversions, roas, cpa, ctr },
          });
        }
      }

      if (ctr < 0.5 && metrics.impressions > 1000) {
        recommendations.push({
          entityType: 'AD_SET',
          entityId: adSet.adSetId,
          entityName: adSet.name,
          action: 'PAUSE',
          reason: `Very low CTR (${ctr.toFixed(2)}%) - creative or targeting may need refresh`,
          priority: 'MEDIUM',
          metrics: { spend: metrics.spend, conversions: metrics.conversions, roas, cpa, ctr },
        });
      }
    }

    // Sort by priority
    recommendations.sort((a, b) => {
      const priorityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    res.json({ data: recommendations });
  } catch (error) {
    next(error);
  }
});

// 2. Execute Action (Mongoose Implementation)
router.post('/execute', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { entityType, entityId, action, reason, performedBy } = req.body;

    if (!entityType || !entityId || !action) {
      return res.status(400).json({ error: 'entityType, entityId, and action are required' });
    }

    let result;
    let previousValue;
    let newValue;

    if (entityType === 'AD_SET') {
      const adSet = await AdSetModel.findOne({ adSetId: entityId });
      if (!adSet) return res.status(404).json({ error: 'Ad set not found' });

      previousValue = { status: adSet.status, budget: adSet.budget };

      if (action === 'PAUSE') {
        adSet.status = 'PAUSED';
        newValue = { status: 'PAUSED', budget: adSet.budget };
      } else if (action === 'SCALE') {
        const newBudget = Math.round(Number(adSet.budget) * 1.2);
        adSet.budget = newBudget;
        newValue = { status: adSet.status, budget: newBudget };
      } else if (action === 'REDUCE_BUDGET') {
        const newBudget = Math.round(Number(adSet.budget) * 0.8);
        adSet.budget = newBudget;
        newValue = { status: adSet.status, budget: newBudget };
      } else if (action === 'ACTIVATE') {
        adSet.status = 'ACTIVE';
        newValue = { status: 'ACTIVE', budget: adSet.budget };
      }

      await adSet.save();
      result = adSet;

    } else if (entityType === 'AD') {
      const ad = await AdModel.findOne({ adId: entityId });
      if (!ad) return res.status(404).json({ error: 'Ad not found' });

      previousValue = { status: ad.status };

      if (action === 'PAUSE') {
        ad.status = 'PAUSED';
        newValue = { status: 'PAUSED' };
      } else if (action === 'ACTIVATE') {
        ad.status = 'ACTIVE';
        newValue = { status: 'ACTIVE' };
      }

      await ad.save();
      result = ad;
    }

    const log = await OptimizationLogModel.create({
      entityType,
      entityId,
      action,
      reason: reason || `Manual ${action.toLowerCase()} action`,
      previousValue: JSON.stringify(previousValue),
      newValue: JSON.stringify(newValue),
      performedBy: performedBy || 'system',
      executedAt: new Date(),
      accountId: null, // Could fetch if needed
    });

    logger.info('Optimization action executed', {
      entityType,
      entityId,
      action,
      logId: log.id
    });

    res.json({
      data: result,
      log,
      message: `${action} action executed successfully`
    });
  } catch (error) {
    next(error);
  }
});

// 3. Get Logs (Mongoose)
router.get('/logs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { entityType, entityId, limit = 50 } = req.query;

    const query: any = {};
    if (entityType) query.entityType = entityType;
    if (entityId) query.entityId = entityId;

    const logs = await OptimizationLogModel.find(query)
      .sort({ executedAt: -1 })
      .limit(Number(limit));

    res.json({
      data: logs,
      pagination: {
        total: logs.length,
        limit: Number(limit),
        offset: 0,
      },
    });
  } catch (error) {
    next(error);
  }
});

// 4. Learning Phase (Mongoose)
router.get('/learning-phase', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { accountId } = req.query;

    const query: any = {
      status: 'ACTIVE',
      learningPhaseStatus: { $in: ['LEARNING', 'LEARNING_LIMITED'] }
    };

    if (accountId) query.accountId = accountId;

    const learningAdSets = await AdSetModel.find(query);

    const result = learningAdSets.map(adSet => ({
      adSetId: adSet.adSetId,
      name: adSet.name,
      campaignId: adSet.campaignId,
      learningPhaseStatus: adSet.learningPhaseStatus,
      optimizationEventsCount: adSet.optimizationEventsCount,
      createdAt: adSet.createdAt,
      eventsNeeded: Math.max(0, 50 - (adSet.optimizationEventsCount || 0)),
      estimatedCompletion: adSet.optimizationEventsCount && adSet.optimizationEventsCount > 0
        ? `~${Math.ceil((50 - adSet.optimizationEventsCount) / (adSet.optimizationEventsCount / 7))} days`
        : 'Unknown'
    }));

    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});

// 5. Optimization Configuration
router.get('/config', (req: Request, res: Response) => {
  res.json({
    success: true,
    config: {
      mode: process.env.OPTIMIZATION_MODE || 'MONITOR'
    }
  });
});

// 6. Activity Feed
router.get('/activity/:adAccountId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { adAccountId } = req.params;
    const { limit = 20 } = req.query;

    const logs = await OptimizationLogModel.find({
      accountId: adAccountId
    })
      .sort({ executedAt: -1 })
      .limit(Number(limit))
      .lean();

    res.json({ success: true, logs });
  } catch (error) {
    next(error);
  }
});

export default router;
