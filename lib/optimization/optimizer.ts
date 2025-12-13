import { AdSetModel, AdModel, PerformanceSnapshotModel, OptimizationLogModel } from '../db/models';
import { 
  PerformanceMetrics, 
  shouldPauseAd, 
  isWinner, 
  calculateScaledBudget,
  detectCreativeFatigue,
  checkLearningPhaseProgress,
  CreativeFatigueSignals
} from './decision-engine';
import { calculateConfidenceInterval } from './statistical';
import { logger } from '../utils/logger';

export type OptimizationAction = 'PAUSE' | 'SCALE' | 'REDUCE_BUDGET' | 'ACTIVATE' | 'MONITOR' | 'REFRESH_CREATIVE';

export interface OptimizationDecision {
  entityType: 'AD_SET' | 'AD';
  entityId: string;
  entityName: string;
  action: OptimizationAction;
  reason: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  confidence: number;
  metrics: {
    spend: number;
    conversions: number;
    roas: number;
    cpa: number;
    ctr: number;
  };
  previousValue?: unknown;
  newValue?: unknown;
}

export interface OptimizationCycleResult {
  cycleId: string;
  startedAt: Date;
  completedAt: Date;
  decisionsAnalyzed: number;
  actionsExecuted: number;
  actionsByType: Record<OptimizationAction, number>;
  errors: string[];
}

export interface OptimizationConfig {
  targetCPA: number;
  targetROAS: number;
  maxBudgetIncreasePercent: number;
  minDataDays: number;
  autoExecute: boolean;
  dryRun: boolean;
}

const DEFAULT_CONFIG: OptimizationConfig = {
  targetCPA: 50,
  targetROAS: 2.0,
  maxBudgetIncreasePercent: 20,
  minDataDays: 3,
  autoExecute: false,
  dryRun: true,
};

export async function analyzeAdSet(
  adSetId: string,
  config: Partial<OptimizationConfig> = {}
): Promise<OptimizationDecision | null> {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  const adSet = await AdSetModel.findOne({ adSetId }).lean().exec();
  if (!adSet || adSet.status !== 'ACTIVE') {
    return null;
  }

  const last7Days = new Date();
  last7Days.setDate(last7Days.getDate() - 7);

  const performanceData = await PerformanceSnapshotModel.aggregate([
    {
      $match: {
        entityType: 'AD_SET',
        entityId: adSetId,
        date: { $gte: last7Days },
      },
    },
    {
      $group: {
        _id: null,
        spend: { $sum: '$spend' },
        impressions: { $sum: '$impressions' },
        clicks: { $sum: '$clicks' },
        conversions: { $sum: '$conversions' },
        revenue: { $sum: '$revenue' },
      },
    },
  ]).exec();

  const perf = performanceData[0] || { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 };

  const ctr = perf.impressions > 0 ? (perf.clicks / perf.impressions) * 100 : 0;
  const cpa = perf.conversions > 0 ? perf.spend / perf.conversions : 0;
  const roas = perf.spend > 0 ? (perf.revenue || 0) / perf.spend : 0;

  const metrics: PerformanceMetrics = {
    impressions: perf.impressions,
    clicks: perf.clicks,
    conversions: perf.conversions,
    spend: perf.spend,
    revenue: perf.revenue,
    ctr,
    cpa,
    roas,
    ageDays: adSet.ageDays || 0,
    optimizationEvents: adSet.optimizationEventsCount || 0,
    dailyBudget: adSet.budget || 0,
    targetCPA: cfg.targetCPA,
    targetROAS: cfg.targetROAS,
  };

  if (adSet.learningPhaseStatus === 'LEARNING') {
    const progress = checkLearningPhaseProgress({
      optimizationEvents: metrics.optimizationEvents,
      ageDays: metrics.ageDays,
      learningStatus: adSet.learningPhaseStatus,
    });

    return {
      entityType: 'AD_SET',
      entityId: adSetId,
      entityName: adSet.name,
      action: 'MONITOR',
      reason: `Learning phase: ${progress.progressPercentage.toFixed(0)}% complete (${progress.eventsCount}/${50} events). Est. ${progress.estimatedCompletionDays} days remaining.`,
      priority: 'LOW',
      confidence: 0.9,
      metrics: {
        spend: perf.spend,
        conversions: perf.conversions,
        roas,
        cpa,
        ctr,
      },
    };
  }

  if (shouldPauseAd(metrics)) {
    let reason = '';
    if (cpa > cfg.targetCPA * 2) {
      reason = `High CPA: $${cpa.toFixed(2)} (target: $${cfg.targetCPA})`;
    } else if (roas < 1) {
      reason = `Low ROAS: ${roas.toFixed(2)}x (losing money)`;
    } else if (ctr < 0.5) {
      reason = `Very low CTR: ${ctr.toFixed(2)}%`;
    }

    return {
      entityType: 'AD_SET',
      entityId: adSetId,
      entityName: adSet.name,
      action: 'PAUSE',
      reason,
      priority: 'HIGH',
      confidence: 0.85,
      metrics: {
        spend: perf.spend,
        conversions: perf.conversions,
        roas,
        cpa,
        ctr,
      },
      previousValue: { status: adSet.status },
      newValue: { status: 'PAUSED' },
    };
  }

  if (isWinner(metrics)) {
    const { newBudget, reason } = calculateScaledBudget(
      adSet.budget || 0,
      adSet.budget ? adSet.budget * 2 : 10000,
      metrics
    );

    return {
      entityType: 'AD_SET',
      entityId: adSetId,
      entityName: adSet.name,
      action: 'SCALE',
      reason: `${reason}. ROAS: ${roas.toFixed(2)}x, CPA: $${cpa.toFixed(2)}`,
      priority: 'MEDIUM',
      confidence: 0.8,
      metrics: {
        spend: perf.spend,
        conversions: perf.conversions,
        roas,
        cpa,
        ctr,
      },
      previousValue: { budget: adSet.budget },
      newValue: { budget: newBudget },
    };
  }

  return null;
}

export async function analyzeAd(
  adId: string,
  config: Partial<OptimizationConfig> = {}
): Promise<OptimizationDecision | null> {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  const ad = await AdModel.findOne({ adId }).lean().exec();
  if (!ad || ad.status !== 'ACTIVE') {
    return null;
  }

  const last7Days = new Date();
  last7Days.setDate(last7Days.getDate() - 7);

  const performanceData = await PerformanceSnapshotModel.aggregate([
    {
      $match: {
        entityType: 'AD',
        entityId: adId,
        date: { $gte: last7Days },
      },
    },
    {
      $group: {
        _id: null,
        spend: { $sum: '$spend' },
        impressions: { $sum: '$impressions' },
        clicks: { $sum: '$clicks' },
        conversions: { $sum: '$conversions' },
        revenue: { $sum: '$revenue' },
      },
    },
  ]).exec();

  const perf = performanceData[0] || { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 };

  const ctr = perf.impressions > 0 ? (perf.clicks / perf.impressions) * 100 : 0;
  const cpa = perf.conversions > 0 ? perf.spend / perf.conversions : 0;
  const roas = perf.spend > 0 ? (perf.revenue || 0) / perf.spend : 0;

  const interval = calculateConfidenceInterval(perf.conversions, perf.clicks);

  if (ad.effectiveStatus === 'DISAPPROVED') {
    return {
      entityType: 'AD',
      entityId: adId,
      entityName: ad.name,
      action: 'MONITOR',
      reason: 'Ad is disapproved - review policy violations',
      priority: 'HIGH',
      confidence: 1.0,
      metrics: {
        spend: perf.spend,
        conversions: perf.conversions,
        roas,
        cpa,
        ctr,
      },
    };
  }

  if (perf.impressions >= 1000 && ctr < 0.3) {
    return {
      entityType: 'AD',
      entityId: adId,
      entityName: ad.name,
      action: 'PAUSE',
      reason: `Very low CTR: ${ctr.toFixed(2)}% - creative not resonating`,
      priority: 'MEDIUM',
      confidence: interval.marginOfError < 1 ? 0.85 : 0.7,
      metrics: {
        spend: perf.spend,
        conversions: perf.conversions,
        roas,
        cpa,
        ctr,
      },
      previousValue: { status: ad.status },
      newValue: { status: 'PAUSED' },
    };
  }

  return null;
}

export async function executeOptimizationDecision(
  decision: OptimizationDecision,
  performedBy: string = 'system'
): Promise<boolean> {
  try {
    if (decision.entityType === 'AD_SET') {
      const update: Record<string, unknown> = {};

      if (decision.action === 'PAUSE') {
        update.status = 'PAUSED';
      } else if (decision.action === 'SCALE' && decision.newValue) {
        update.budget = (decision.newValue as { budget: number }).budget;
      } else if (decision.action === 'REDUCE_BUDGET' && decision.newValue) {
        update.budget = (decision.newValue as { budget: number }).budget;
      } else if (decision.action === 'ACTIVATE') {
        update.status = 'ACTIVE';
      }

      if (Object.keys(update).length > 0) {
        await AdSetModel.findOneAndUpdate(
          { adSetId: decision.entityId },
          { $set: update }
        ).exec();
      }
    } else if (decision.entityType === 'AD') {
      const update: Record<string, unknown> = {};

      if (decision.action === 'PAUSE') {
        update.status = 'PAUSED';
      } else if (decision.action === 'ACTIVATE') {
        update.status = 'ACTIVE';
      }

      if (Object.keys(update).length > 0) {
        await AdModel.findOneAndUpdate(
          { adId: decision.entityId },
          { $set: update }
        ).exec();
      }
    }

    await OptimizationLogModel.create({
      entityType: decision.entityType,
      entityId: decision.entityId,
      action: decision.action,
      reason: decision.reason,
      previousValue: JSON.stringify(decision.previousValue),
      newValue: JSON.stringify(decision.newValue),
      performedBy,
      performedAt: new Date(),
    });

    logger.info('Optimization decision executed', {
      entityType: decision.entityType,
      entityId: decision.entityId,
      action: decision.action,
    });

    return true;
  } catch (error) {
    logger.error('Failed to execute optimization decision', {
      decision,
      error,
    });
    return false;
  }
}

export async function runOptimizationCycle(
  accountId?: string,
  config: Partial<OptimizationConfig> = {}
): Promise<OptimizationCycleResult> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const cycleId = `opt_${Date.now()}`;
  const startedAt = new Date();
  const errors: string[] = [];
  const actionsByType: Record<OptimizationAction, number> = {
    PAUSE: 0,
    SCALE: 0,
    REDUCE_BUDGET: 0,
    ACTIVATE: 0,
    MONITOR: 0,
    REFRESH_CREATIVE: 0,
  };

  logger.info('Starting optimization cycle', { cycleId, accountId, config: cfg });

  const adSetFilter: Record<string, unknown> = { status: 'ACTIVE' };
  if (accountId) adSetFilter.accountId = accountId;

  const activeAdSets = await AdSetModel.find(adSetFilter).select('adSetId').lean().exec();
  
  let decisionsAnalyzed = 0;
  let actionsExecuted = 0;

  for (const adSet of activeAdSets) {
    try {
      const decision = await analyzeAdSet(adSet.adSetId, cfg);
      decisionsAnalyzed++;

      if (decision && decision.action !== 'MONITOR') {
        actionsByType[decision.action]++;

        if (cfg.autoExecute && !cfg.dryRun) {
          const success = await executeOptimizationDecision(decision, 'auto_optimizer');
          if (success) actionsExecuted++;
        }
      }
    } catch (error) {
      errors.push(`AdSet ${adSet.adSetId}: ${error}`);
    }
  }

  const adFilter: Record<string, unknown> = { status: 'ACTIVE' };
  if (accountId) adFilter.accountId = accountId;

  const activeAds = await AdModel.find(adFilter).select('adId').lean().exec();

  for (const ad of activeAds) {
    try {
      const decision = await analyzeAd(ad.adId, cfg);
      decisionsAnalyzed++;

      if (decision && decision.action !== 'MONITOR') {
        actionsByType[decision.action]++;

        if (cfg.autoExecute && !cfg.dryRun) {
          const success = await executeOptimizationDecision(decision, 'auto_optimizer');
          if (success) actionsExecuted++;
        }
      }
    } catch (error) {
      errors.push(`Ad ${ad.adId}: ${error}`);
    }
  }

  const completedAt = new Date();

  logger.info('Optimization cycle completed', {
    cycleId,
    duration: completedAt.getTime() - startedAt.getTime(),
    decisionsAnalyzed,
    actionsExecuted,
    actionsByType,
    errorCount: errors.length,
  });

  return {
    cycleId,
    startedAt,
    completedAt,
    decisionsAnalyzed,
    actionsExecuted,
    actionsByType,
    errors,
  };
}

export async function getOptimizationSummary(accountId?: string): Promise<{
  totalActive: number;
  inLearning: number;
  needsAttention: number;
  winners: number;
  underperformers: number;
}> {
  const filter: Record<string, unknown> = { status: 'ACTIVE' };
  if (accountId) filter.accountId = accountId;

  const [totalActive, inLearning] = await Promise.all([
    AdSetModel.countDocuments(filter).exec(),
    AdSetModel.countDocuments({ ...filter, learningPhaseStatus: 'LEARNING' }).exec(),
  ]);

  return {
    totalActive,
    inLearning,
    needsAttention: 0,
    winners: 0,
    underperformers: 0,
  };
}
