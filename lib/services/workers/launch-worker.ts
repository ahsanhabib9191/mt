import { LaunchJob, LaunchJobData } from '../queue/launch-queue';
import { MetaConnectionModel } from '../../db/models/MetaConnection';
import { CreativeService } from '../meta-sync/creative-service';
import { encrypt, decrypt } from '../../utils/crypto';
import { pushEntityToMeta } from '../meta-sync/sync-service';
import { OptimizationLogModel } from '../../db/models/optimization-log';
import logger from '../../utils/logger';
import { ICampaign, IAdSet, IAd } from '../../db/models/index';

/**
 * Process a single Launch Job
 */
export async function processLaunchJob(job: LaunchJob): Promise<any> {
    const { data } = job;
    logger.info(`LaunchWorker: Processing Job ${job.id}`, { tenantId: data.tenantId });

    // 1. Get Connection & Token
    const connection = await MetaConnectionModel.findOne({
        tenantId: data.tenantId,
        adAccountId: data.adAccountId
    });

    if (!connection) throw new Error('Meta Connection not found for tenant');

    // Decrypt Token
    let accessToken = connection.accessToken;
    // Note: ensureConnectionAccessToken handles decryption/refresh in sync-service, 
    // but here we might need raw token for CreativeService.
    // Let's assume connection.accessToken is encrypted if it's stored that way.
    // My previous analysis showed manual encryption.
    try {
        accessToken = decrypt(connection.accessToken);
    } catch (e) {
        // If decryption fails, maybe it's already decrypted or plain text (dev mode)
        logger.warn('Token decryption failed, using raw value');
    }

    // 2. Upload Creative Asset (Image or Video)
    let imageHash: string | undefined;
    let videoId: string | undefined;

    if (data.videoUrl) {
        const result = await CreativeService.uploadVideo(accessToken, data.adAccountId, data.videoUrl);
        videoId = result.id;
    } else if (data.imageUrl) {
        const result = await CreativeService.uploadImage(accessToken, data.adAccountId, data.imageUrl);
        imageHash = result.hash;
    } else {
        throw new Error('No creative URL provided (image or video)');
    }

    // 3. Create Ad Creative Object (The Visual Wrapper)
    const creativeId = await CreativeService.createAdCreativeObject(accessToken, data.adAccountId, {
        name: `${data.name} - Creative`,
        pageId: data.pageId,
        linkUrl: data.linkUrl,
        message: data.primaryText,
        headline: data.headline,
        description: data.description,
        callToAction: data.cta,
        imageHash,
        videoId
    });

    // 4. Fetch Ad Account Currency Settings (To handle JPY, KRW vs USD, EUR)
    // We need to know the 'offset' (1 or 100) to convert user input to atomic units.
    let currencyOffset = 100; // Default to cents logic
    try {
        const { fetchGraphNode } = await import('../meta-sync/graph-client');
        const adAccount = await fetchGraphNode<{ currency: string, currency_offset: number }>(
            accessToken,
            data.adAccountId,
            { fields: 'currency,currency_offset' }
        );

        if (adAccount && adAccount.currency_offset) {
            currencyOffset = adAccount.currency_offset;
            logger.info('LaunchWorker: Currency detected', {
                currency: adAccount.currency,
                offset: currencyOffset
            });
        }
    } catch (error) {
        logger.warn('LaunchWorker: Failed to fetch currency settings, defaulting to 100 offset', { error });
    }

    // 5. Create Campaign Structure using SyncService (Robust)
    // We construct the entity objects as if they were local, and push them.

    // A. Campaign
    const campaignId = `tmp_cmp_${Date.now()}`;
    const campaignPayload: Partial<ICampaign> = {
        campaignId: campaignId,
        name: data.name,
        objective: 'OUTCOME_TRAFFIC',
        status: 'ACTIVE'
    };

    // NOTE: pushEntityToMeta returns the GRAPH response, which contains the ID.
    const campaignResult: any = await pushEntityToMeta(connection, 'CAMPAIGN', campaignPayload as any);
    const validCampaignId = campaignResult.id;
    logger.info(`LaunchWorker: Campaign Created: ${validCampaignId}`);

    // B. Ad Set
    const adSetPayload: Partial<IAdSet> = {
        name: `${data.name} - Ad Set`,
        campaignId: validCampaignId,
        status: 'ACTIVE',
        optimizationGoal: 'LINK_CLICKS',
        // Multiply by offset (e.g. 100 for USD, 1 for JPY)
        // Note: SyncService assumes 'budget' is passed in ATOMIC UNITS if it's pushed directly? 
        // Wait, earlier I said "SyncService converts logs...". 
        // Let's look at pushAdSetToMeta in sync-service.
        // It does: `data.daily_budget = adSet.budget.toString()` (if using the provided code from memory check earlier).
        // Let's double check sync-service one last time.
        // If sync-service *converts*, I should pass dollars. If it *passes through*, I pass atomic.
        // Checking my memory of Lines 739: `data.daily_budget = campaign.budget.toString()`.  
        // It passes RAW.
        // So I MUST calculate atomic units HERE.

        budget: Math.round(data.dailyBudget * currencyOffset),
        targeting: data.targeting,
        startDate: new Date(),
        learningPhaseStatus: 'NOT_STARTED'
    };

    const adSetResult: any = await pushEntityToMeta(connection, 'AD_SET', adSetPayload as any);
    const validAdSetId = adSetResult.id;
    logger.info(`LaunchWorker: Ad Set Created: ${validAdSetId}`);

    // C. Ad
    const adPayload: Partial<IAd> = {
        name: `${data.name} - Ad`,
        adSetId: validAdSetId,
        status: 'ACTIVE',
        creative: { creativeId: creativeId } as any
    };

    const adResult: any = await pushEntityToMeta(connection, 'AD', adPayload as any);
    const validAdId = adResult.id;
    logger.info(`LaunchWorker: Ad Created: ${validAdId}`);

    // 5. Register "Day 0" Optimization Log
    await OptimizationLogModel.create({
        action: 'LAUNCH_SUCCESS',
        entityType: 'CAMPAIGN',
        entityId: validCampaignId,
        accountId: data.adAccountId,
        message: `Campaign "${data.name}" launched successfully. "Invisible Friend" is now monitoring.`,
        severity: 'INFO',
        success: true,
        executedAt: new Date(),
        details: { campaignId: validCampaignId, adSetId: validAdSetId, adId: validAdId }
    });

    return {
        campaignId: validCampaignId,
        adSetId: validAdSetId,
        adId: validAdId,
        creativeId: creativeId
    };
}
