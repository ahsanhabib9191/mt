import { Router, Request, Response, NextFunction } from 'express';
import { PerformanceSnapshotModel } from '../../lib/db/models/performance-snapshot';
import { CampaignModel } from '../../lib/db/models/campaign';
import { AdSetModel } from '../../lib/db/models/ad-set';
import { AdModel } from '../../lib/db/models/ad';

const router = Router();

router.get('/dashboard', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { accountId, dateFrom, dateTo } = req.query;

    // Date Range
    const startDate = dateFrom ? new Date(dateFrom as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = dateTo ? new Date(dateTo as string) : new Date();

    // Entity Counts
    const accountFilter = accountId ? { accountId: accountId as string } : {};

    const [campaignCount, adSetCount, adCount, learningCount] = await Promise.all([
      CampaignModel.countDocuments({ ...accountFilter, status: { $ne: 'ARCHIVED' } }),
      AdSetModel.countDocuments({ ...accountFilter, status: { $ne: 'ARCHIVED' } }),
      AdModel.countDocuments({ ...accountFilter, status: { $ne: 'ARCHIVED' } }),
      AdSetModel.countDocuments({ ...accountFilter, status: 'ACTIVE', learningPhaseStatus: 'LEARNING' })
    ]);

    // Performance Metrics Aggregation
    // We sum 'CAMPAIGN' level snapshots to avoid double counting (AdSets, Ads)
    const matchStage: { date: { $gte: Date; $lte: Date }; entityType: string; accountId?: string } = {
      date: { $gte: startDate, $lte: endDate },
      entityType: 'CAMPAIGN'
    };
    if (accountId) {
      matchStage.accountId = accountId as string;
    }

    const stats = await PerformanceSnapshotModel.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalSpend: { $sum: '$spend' },
          totalImpressions: { $sum: '$impressions' },
          totalClicks: { $sum: '$clicks' },
          totalConversions: { $sum: '$conversions' },
          totalRevenue: { $sum: '$revenue' }
        }
      }
    ]);

    const m = stats[0] || { totalSpend: 0, totalImpressions: 0, totalClicks: 0, totalConversions: 0, totalRevenue: 0 };

    const ctr = m.totalImpressions > 0 ? (m.totalClicks / m.totalImpressions * 100) : 0;
    const cpc = m.totalClicks > 0 ? (m.totalSpend / m.totalClicks) : 0;
    const cpa = m.totalConversions > 0 ? (m.totalSpend / m.totalConversions) : 0;
    const roas = m.totalSpend > 0 ? (m.totalRevenue / m.totalSpend) : 0;

    res.json({
      success: true,
      data: {
        entities: {
          campaigns: campaignCount,
          adSets: adSetCount,
          ads: adCount,
          learningAdSets: learningCount,
          adsWithIssues: 0,
        },
        metrics: {
          spend: Number(m.totalSpend || 0),
          impressions: Number(m.totalImpressions || 0),
          clicks: Number(m.totalClicks || 0),
          conversions: Number(m.totalConversions || 0),
          revenue: Number(m.totalRevenue || 0),
          ctr: Number(ctr.toFixed(2)),
          cpc: Number(cpc.toFixed(2)),
          cpa: Number(cpa.toFixed(2)),
          roas: Number(roas.toFixed(2)),
        },
      },
    });

  } catch (error) {
    next(error);
  }
});

router.get('/trends', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { accountId, days = 7 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - Number(days));

    const matchStage: { date: { $gte: Date }; entityType: string; accountId?: string } = {
      date: { $gte: startDate },
      entityType: 'CAMPAIGN'
    };
    if (accountId) {
      matchStage.accountId = accountId as string;
    }

    const trends = await PerformanceSnapshotModel.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
          spend: { $sum: "$spend" },
          impressions: { $sum: "$impressions" },
          clicks: { $sum: "$clicks" },
          conversions: { $sum: "$conversions" },
          revenue: { $sum: "$revenue" }
        }
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          date: "$_id",
          spend: 1,
          impressions: 1,
          clicks: 1,
          conversions: 1,
          revenue: 1,
          _id: 0
        }
      }
    ]);

    res.json({ success: true, data: trends });

  } catch (error) {
    next(error);
  }
});

export default router;
