import { MetaConnectionModel, IMetaConnection } from '../../db/models/MetaConnection';
import { CampaignModel } from '../../db/models/campaign';
import { AdSetModel } from '../../db/models/ad-set';
import { AdModel } from '../../db/models/ad';
import { fetchInsights } from '../meta-sync/graph-client';
import { ensureConnectionAccessToken } from '../meta-sync/graph-client';
import { pushEntityToMeta } from '../meta-sync/sync-service';
import logger from '../../utils/logger';
import { OptimizationLogModel } from '../../db/models/optimization-log';

// --- Types ---

export interface OptimizationRule {
    id: string;
    name: string;
    metric: 'ROAS' | 'CPA' | 'CPR' | 'SPEND';
    condition: 'GT' | 'LT'; // Greater Than / Less Than
    threshold: number;
    action: 'PAUSE' | 'SCALE_BUDGET' | 'NOTIFY';
    actionValue?: number; // e.g., 20% increase
    level: 'CAMPAIGN' | 'AD_SET' | 'AD';
    lookbackDays: number;
}

export interface OptimizationResult {
    ruleId: string;
    entityId: string;
    entityType: 'CAMPAIGN' | 'AD_SET' | 'AD';
    actionTaken: string;
    oldValue: string | number | boolean;
    newValue: string | number | boolean;
    metricValue: number;
    timestamp: Date;
}

// --- Constants ---

// Default rules (In a real app, these would come from DB)
const DEFAULT_RULES: OptimizationRule[] = [
    {
        id: 'kill_high_cpa',
        name: 'Kill High CPA Ads',
        metric: 'CPA', // Cost Per Action (or Cost Per Result)
        condition: 'GT',
        threshold: 50.0, // $50 CPA limit
        action: 'PAUSE',
        level: 'AD',
        lookbackDays: 3
    },
    {
        id: 'scale_high_roas',
        name: 'Scale High ROAS Ad Sets',
        metric: 'ROAS', // Return on Ad Spend
        condition: 'GT',
        threshold: 2.0, // 200% ROAS
        action: 'SCALE_BUDGET',
        actionValue: 0.2, // Increase budget by 20%
        level: 'AD_SET',
        lookbackDays: 7
    }
];

// --- Service ---

export class OptimizationService {

    /**
     * Run optimization cycle for a specific connection
     */
    static async runOptimization(connectionId: string): Promise<OptimizationResult[]> {
        const connection = await MetaConnectionModel.findById(connectionId);
        if (!connection || connection.status !== 'ACTIVE') {
            throw new Error('Invalid or inactive connection');
        }

        logger.info('Starting Optimization Cycle', { connectionId, adAccountId: connection.adAccountId });
        const results: OptimizationResult[] = [];

        // Create Log Entry for Cycle Start
        await OptimizationLogModel.create({
            action: 'CYCLE_START',
            entityType: 'ACCOUNT',
            entityId: connection.adAccountId,
            accountId: connection.adAccountId,
            success: true,
            executedAt: new Date(),
            message: 'Starting optimization health check',
            reason: 'Scheduled Health Check',
            severity: 'INFO'
        });

        // 1. Fetch Performance Data
        // ... (existing fetch logic remains) ...

        // Ensure token
        const { accessToken } = await ensureConnectionAccessToken(connection);

        // Fetch Ad Level Insights
        const adInsights = await fetchInsights<any>(
            accessToken,
            connection.adAccountId,
            {
                date_preset: 'last_7d',
                level: 'ad',
                fields: 'ad_id,ad_name,spend,cpc,cpm,cpp,ctr,actions,action_values,cost_per_action_type'
            },
            connection.tenantId
        );

        // Fetch Ad Set Level Insights (for scaling rules)
        const adSetInsights = await fetchInsights<any>(
            accessToken,
            connection.adAccountId,
            {
                date_preset: 'last_7d',
                level: 'adset',
                fields: 'adset_id,adset_name,spend,cpc,cpm,cpp,ctr,actions,action_values,cost_per_action_type'
            },
            connection.tenantId
        );

        // 2. Evaluate Rules

        // Check functionality mode
        const MODE = process.env.OPTIMIZATION_MODE || 'MONITOR';
        const isDryRun = MODE !== 'ACTIVE';

        // --- Rule 1: Kill High CPA Ads ---
        const highCpaRule = DEFAULT_RULES.find(r => r.id === 'kill_high_cpa')!;

        for (const data of adInsights) {
            const spend = parseFloat(data.spend || '0');
            const purchases = data.actions?.find((a: any) => a.action_type === 'purchase' || a.action_type === 'offsite_conversion.fb_pixel_purchase')?.value || 0;
            const purchaseCount = parseFloat(purchases);

            let cpa = 0;
            if (purchaseCount > 0) {
                cpa = spend / purchaseCount;
            } else if (spend > highCpaRule.threshold * 1.5) {
                cpa = spend;
            }

            if (spend > 10 && cpa > highCpaRule.threshold) {
                const adId = data.ad_id;
                const adName = data.ad_name || 'Unknown Ad';

                logger.info(`Rule Triggered: High CPA (${isDryRun ? 'MONITOR' : 'ACTIVE'})`, { adId, cpa, threshold: highCpaRule.threshold });

                const ad = await AdModel.findOne({ adId: adId });
                if (ad && ad.status === 'ACTIVE') {
                    try {
                        if (isDryRun) {
                            // SIMULATION
                            await OptimizationLogModel.create({
                                action: 'RECOMMEND_PAUSE',
                                entityType: 'AD',
                                entityId: adId,
                                accountId: connection.adAccountId,
                                ruleId: highCpaRule.id,
                                success: true,
                                executedAt: new Date(),
                                message: `[SIMULATION] Would have paused ad "${adName}" because CPA ($${cpa.toFixed(2)}) > $${highCpaRule.threshold}`,
                                reason: 'High CPA (Monitor Only)',
                                severity: 'INFO',
                                details: { cpa, threshold: highCpaRule.threshold, spend }
                            });

                            results.push({
                                ruleId: highCpaRule.id,
                                entityId: adId,
                                entityType: 'AD',
                                actionTaken: 'RECOMMEND_PAUSE',
                                oldValue: 'ACTIVE',
                                newValue: 'PAUSED',
                                metricValue: cpa,
                                timestamp: new Date()
                            });
                        } else {
                            // EXECUTION
                            await pushEntityToMeta(connection, 'AD', { ...ad.toObject(), status: 'PAUSED' } as any);

                            ad.status = 'PAUSED';
                            await ad.save();

                            await OptimizationLogModel.create({
                                action: 'PAUSE',
                                entityType: 'AD',
                                entityId: adId,
                                accountId: connection.adAccountId,
                                ruleId: highCpaRule.id,
                                success: true,
                                executedAt: new Date(),
                                message: `Paused ad "${adName}" because CPA ($${cpa.toFixed(2)}) > $${highCpaRule.threshold}`,
                                reason: 'High CPA Rule Violation',
                                severity: 'ACTION',
                                details: { cpa, threshold: highCpaRule.threshold, spend }
                            });

                            results.push({
                                ruleId: highCpaRule.id,
                                entityId: adId,
                                entityType: 'AD',
                                actionTaken: 'PAUSE',
                                oldValue: 'ACTIVE',
                                newValue: 'PAUSED',
                                metricValue: cpa,
                                timestamp: new Date()
                            });
                        }
                    } catch (error: any) {
                        logger.error('Failed to execute optimization action', { error, adId });
                        // ... existing error logging ...
                    }
                }
            }
        }

        // --- Rule 2: Scale High ROAS Ad Sets ---
        const scaleRoasRule = DEFAULT_RULES.find(r => r.id === 'scale_high_roas')!;

        for (const data of adSetInsights) {
            const spend = parseFloat(data.spend || '0');
            const purchaseValue = data.action_values?.find((a: any) => a.action_type === 'purchase' || a.action_type === 'offsite_conversion.fb_pixel_purchase')?.value || 0;
            const value = parseFloat(purchaseValue);

            const roas = spend > 0 ? value / spend : 0;

            if (spend > 50 && roas > scaleRoasRule.threshold) {
                const adSetId = data.adset_id;
                const adSetName = data.adset_name || 'Unknown Ad Set';

                logger.info(`Rule Triggered: High ROAS (${isDryRun ? 'MONITOR' : 'ACTIVE'})`, { adSetId, roas, threshold: scaleRoasRule.threshold });

                const adSet = await AdSetModel.findOne({ adSetId: adSetId });
                if (adSet && adSet.status === 'ACTIVE' && adSet.budget) {
                    const oldBudget = adSet.budget;
                    const increase = oldBudget * (scaleRoasRule.actionValue || 0.2);
                    const newBudget = Math.round((oldBudget + increase) * 100) / 100;

                    try {
                        if (isDryRun) {
                            // SIMULATION
                            await OptimizationLogModel.create({
                                action: 'RECOMMEND_SCALE',
                                entityType: 'AD_SET',
                                entityId: adSetId,
                                accountId: connection.adAccountId,
                                ruleId: scaleRoasRule.id,
                                success: true,
                                executedAt: new Date(),
                                message: `[SIMULATION] Would have increased budget for "${adSetName}" to $${newBudget} (ROAS: ${roas.toFixed(2)})`,
                                reason: 'High ROAS (Monitor Only)',
                                severity: 'INFO',
                                details: { roas, oldBudget, newBudget }
                            });

                            results.push({
                                ruleId: scaleRoasRule.id,
                                entityId: adSetId,
                                entityType: 'AD_SET',
                                actionTaken: 'RECOMMEND_SCALE',
                                oldValue: oldBudget,
                                newValue: newBudget,
                                metricValue: roas,
                                timestamp: new Date()
                            });
                        } else {
                            // EXECUTION
                            await pushEntityToMeta(connection, 'AD_SET', {
                                ...adSet.toObject(),
                                budget: newBudget
                            } as any);

                            adSet.budget = newBudget;
                            await adSet.save();

                            await OptimizationLogModel.create({
                                action: 'SCALE_BUDGET',
                                entityType: 'AD_SET',
                                entityId: adSetId,
                                accountId: connection.adAccountId,
                                ruleId: scaleRoasRule.id,
                                success: true,
                                executedAt: new Date(),
                                message: `Increased budget for "${adSetName}" to $${newBudget} because ROAS is ${roas.toFixed(2)}`,
                                reason: 'High ROAS Opportunity',
                                severity: 'ACTION',
                                details: { roas, oldBudget, newBudget }
                            });

                            results.push({
                                ruleId: scaleRoasRule.id,
                                entityId: adSetId,
                                entityType: 'AD_SET',
                                actionTaken: 'SCALE_BUDGET',
                                oldValue: oldBudget,
                                newValue: newBudget,
                                metricValue: roas,
                                timestamp: new Date()
                            });
                        }

                    } catch (error: any) {
                        logger.error('Failed to execute scaling action', { error, adSetId });
                        // ... existing error logging ...
                    }
                }
            }
        }

        // Create Log Entry for Cycle End
        await OptimizationLogModel.create({
            action: 'CYCLE_COMPLETE',
            entityType: 'ACCOUNT',
            entityId: connection.adAccountId,
            accountId: connection.adAccountId,
            success: true,
            executedAt: new Date(),
            message: `Optimization cycle complete (${isDryRun ? 'MONITOR' : 'ACTIVE'}). Found ${results.length} recommendations/actions.`,
            reason: 'Scheduled Health Check',
            severity: 'INFO',
            details: { actionCount: results.length, mode: MODE }
        });

        logger.info('Optimization Cycle Complete', { count: results.length, mode: MODE });
        return results;

    }
}
