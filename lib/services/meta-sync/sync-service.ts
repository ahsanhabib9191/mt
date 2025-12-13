import { AdModel } from '../../db/models/ad';
import { AdSetModel, ITargeting } from '../../db/models/ad-set';
import { CampaignModel } from '../../db/models/campaign';
import {
  IMetaConnection,
  MetaConnectionModel,
} from '../../db/models/MetaConnection';
import { PerformanceSnapshotModel, EntityType } from '../../db/models/performance-snapshot';
import logger from '../../utils/logger';
import { redis } from '../../db/redis';
import {
  buildGraphEdgeParams,
  ensureConnectionAccessToken,
  fetchGraphEdges,
  fetchGraphNode,
  fetchInsights,
  postGraphEdge,
  MetaAPIError,
} from './graph-client';
import { ICampaign } from '../../db/models/campaign';
import { IAd, AdStatus } from '../../db/models/ad';
import { IAdSet, AdSetStatus } from '../../db/models/ad-set';

interface GraphCampaign {
  id: string;
  name: string;
  status?: string;
  objective?: string;
  daily_budget?: string;
  start_time?: string;
  stop_time?: string;
}

interface GraphAdSet {
  id: string;
  name: string;
  status?: string;
  daily_budget?: string;
  targeting?: Record<string, any>;
  optimization_goal?: string;
  learning_phase_status?: string;
  start_time?: string;
  end_time?: string;
  campaign_id?: string;
  delivery_info?: Record<string, any>;
}

interface GraphAd {
  id: string;
  name: string;
  status?: string;
  effective_status?: string;
  adset_id?: string;
  creative?: Record<string, any>;
  issues_info?: Array<{
    error_code: number;
    error_message: string;
    error_summary: string;
    level: string;
  }>;
}

interface GraphInsights {
  date_start: string;
  date_stop: string;
  impressions?: string;
  clicks?: string;
  spend?: string;
  actions?: Array<{ action_type: string; value: string }>;
  action_values?: Array<{ action_type: string; value: string }>;
}

const campaignFields = [
  'id',
  'name',
  'status',
  'objective',
  'daily_budget',
  'start_time',
  'stop_time',
];

const adSetFields = [
  'id',
  'name',
  'status',
  'daily_budget',
  'targeting',
  'optimization_goal',
  'learning_phase_status',
  'start_time',
  'end_time',
  'campaign_id',
];

const adFields = [
  'id',
  'name',
  'status',
  'effective_status',
  'adset_id',
  'creative',
  'issues_info',
];

const insightFields = [
  'impressions',
  'clicks',
  'spend',
  'actions',
  'action_values',
  'conversions',
  'conversion_values',
];

const campaignStatusMap: Record<string, string> = {
  ACTIVE: 'ACTIVE',
  PAUSED: 'PAUSED',
  ARCHIVED: 'ARCHIVED',
  DRAFT: 'DRAFT',
  LEARNING: 'LEARNING',
  LEARNING_LIMITED: 'LEARNING_LIMITED',
};

const adSetStatusMap: Record<string, string> = {
  ACTIVE: 'ACTIVE',
  PAUSED: 'PAUSED',
  ARCHIVED: 'ARCHIVED',
};

const adStatusMap: Record<string, string> = {
  ACTIVE: 'ACTIVE',
  PAUSED: 'PAUSED',
  ARCHIVED: 'ARCHIVED',
  DRAFT: 'DRAFT',
};

const adEffectiveStatusMap: Record<string, string> = {
  ACTIVE: 'ACTIVE',
  PAUSED: 'PAUSED',
  DISAPPROVED: 'DISAPPROVED',
  PENDING_REVIEW: 'PENDING_REVIEW',
  ARCHIVED: 'ARCHIVED',
  DELETED: 'DELETED',
  ADSET_PAUSED: 'ADSET_PAUSED',
  CAMPAIGN_PAUSED: 'CAMPAIGN_PAUSED',
};

function normalizeCampaignStatus(status?: string): string {
  if (!status) return 'DRAFT';
  return campaignStatusMap[status] || 'DRAFT';
}

function normalizeAdSetStatus(status?: string): string {
  if (!status) return 'DRAFT';
  return adSetStatusMap[status] || 'DRAFT';
}

function normalizeLearningPhase(status?: string): string {
  if (!status) return 'NOT_STARTED';
  const upper = status.toUpperCase();
  if (upper.includes('LEARNING')) return 'LEARNING';
  if (upper.includes('ACTIVE')) return 'ACTIVE';
  return 'NOT_STARTED';
}

function normalizeAdStatus(status?: string): string {
  if (!status) return 'DRAFT';
  return adStatusMap[status] || 'DRAFT';
}

function normalizeAdEffectiveStatus(status?: string): string {
  if (!status) return 'PAUSED';
  return adEffectiveStatusMap[status] || 'PAUSED';
}

function mapTargeting(targeting?: Record<string, any>): ITargeting {
  if (!targeting) {
    return {};
  }

  const countries:
    | string[]
    | undefined = targeting.geo_locations?.countries?.map((c: any) => c.key) ?? targeting.geo_locations?.countries;
  const locations: string[] = [];
  if (countries) {
    locations.push(...countries.filter(Boolean));
  }

  return {
    audienceSize: targeting.app_store_audience_size,
    ageMin: targeting.age_min,
    ageMax: targeting.age_max,
    genders: targeting.genders,
    locations,
    interests: targeting.interests?.map((interest: any) => interest.name),
    customAudiences: targeting.custom_audiences,
    lookalikes: targeting.lookalike_specs?.map((lookalike: any) => lookalike.name),
    exclusions: targeting.excluded_custom_audiences,
  };
}

function mapCreative(creative?: Record<string, any>): Record<string, any> {
  if (!creative) {
    return {};
  }

  return {
    creativeId: creative.id,
    type: creative.asset_feed_spec?.attachment_style || creative.object_story_spec?.link_data?.link, // best effort
    headline: creative.title || creative.headline || creative.name,
    body: creative.body || creative.message,
    callToAction:
      (creative.object_story_spec?.link_data?.call_to_action?.type as string) || creative.call_to_action?.type,
    linkUrl: creative.link_url || creative.object_story_spec?.link_data?.link,
    metadata: creative,
  };
}

export async function upsertCampaignFromGraph(payload: GraphCampaign, accountId: string) {
  const mapped = {
    campaignId: payload.id,
    accountId,
    name: payload.name,
    objective: payload.objective ?? 'OUTCOME_TRAFFIC',
    status: normalizeCampaignStatus(payload.status),
    budget: payload.daily_budget ? Number(payload.daily_budget) : 0,
    startDate: payload.start_time ? new Date(payload.start_time) : undefined,
    endDate: payload.stop_time ? new Date(payload.stop_time) : undefined,
  };

  return CampaignModel.findOneAndUpdate({ campaignId: payload.id }, mapped, {
    new: true,
    upsert: true,
    setDefaultsOnInsert: true,
  }).exec();
}

export async function upsertAdSetFromGraph(payload: GraphAdSet, accountId: string) {
  const mapped = {
    adSetId: payload.id,
    campaignId: payload.campaign_id || '',
    accountId,
    name: payload.name,
    status: normalizeAdSetStatus(payload.status),
    budget: payload.daily_budget ? Number(payload.daily_budget) : 0,
    targeting: mapTargeting(payload.targeting),
    learningPhaseStatus: normalizeLearningPhase(payload.learning_phase_status),
    optimizationGoal: payload.optimization_goal || 'LINK_CLICKS',
    startDate: payload.start_time ? new Date(payload.start_time) : undefined,
    endDate: payload.end_time ? new Date(payload.end_time) : undefined,
    deliveryStatus: payload.delivery_info?.status,
    optimizationEventsCount: payload.delivery_info?.daily_spend
      ? Number(payload.delivery_info.daily_spend)
      : undefined,
  };

  return AdSetModel.findOneAndUpdate({ adSetId: payload.id }, mapped, {
    new: true,
    upsert: true,
    setDefaultsOnInsert: true,
  }).exec();
}

export async function upsertAdFromGraph(payload: GraphAd, accountId: string, campaignId?: string) {
  const mapped = {
    adId: payload.id,
    adSetId: payload.adset_id || '',
    campaignId: campaignId || '',
    accountId,
    name: payload.name,
    status: normalizeAdStatus(payload.status),
    creative: mapCreative(payload.creative),
    effectiveStatus: normalizeAdEffectiveStatus(payload.effective_status),
    issues: mapIssues(payload.effective_status, payload.issues_info),
  };

  return AdModel.findOneAndUpdate({ adId: payload.id }, mapped, {
    new: true,
    upsert: true,
    setDefaultsOnInsert: true,
  }).exec();
}

function mapIssues(effectiveStatus?: string, issuesInfo?: Array<any>) {
  const issues: Array<any> = [];

  if (issuesInfo && issuesInfo.length > 0) {
    issues.push(...issuesInfo.map(issue => ({
      errorCode: String(issue.error_code),
      errorMessage: issue.error_message,
      errorSummary: issue.error_summary,
      level: issue.level === 'ERROR' ? 'ERROR' : 'WARNING',
    })));
  }

  if (effectiveStatus?.toUpperCase() === 'DISAPPROVED' && issues.length === 0) {
    issues.push({
      errorCode: 'DISAPPROVED',
      errorMessage: 'Ad disapproved by Meta',
      level: 'ERROR',
    });
  }

  return issues;
}

function extractConversions(actions?: Array<{ action_type: string; value: string }>): number {
  if (!actions) return 0;

  const conversionActions = actions.filter(action =>
    action.action_type.includes('purchase') ||
    action.action_type.includes('lead') ||
    action.action_type.includes('conversion')
  );

  return conversionActions.reduce((sum, action) => sum + parseFloat(action.value || '0'), 0);
}

function extractRevenue(actionValues?: Array<{ action_type: string; value: string }>): number {
  if (!actionValues) return 0;

  const purchaseValues = actionValues.filter(action =>
    action.action_type.includes('purchase') ||
    action.action_type.includes('revenue')
  );

  return purchaseValues.reduce((sum, action) => sum + parseFloat(action.value || '0'), 0);
}

export async function upsertPerformanceSnapshot(
  entityType: EntityType,
  entityId: string,
  insights: GraphInsights
) {
  const date = new Date(insights.date_start);
  date.setHours(0, 0, 0, 0); // Normalize to start of day

  const mapped = {
    entityType,
    entityId,
    date,
    impressions: parseInt(insights.impressions || '0'),
    clicks: parseInt(insights.clicks || '0'),
    spend: parseFloat(insights.spend || '0'),
    conversions: extractConversions(insights.actions),
    revenue: extractRevenue(insights.action_values),
  };

  return PerformanceSnapshotModel.findOneAndUpdate(
    { entityType, entityId, date },
    mapped,
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    }
  ).exec();
}

export async function syncPerformanceData(
  connection: IMetaConnection,
  entityType: EntityType,
  entityId: string,
  datePreset: string = 'last_7d'
): Promise<number> {
  try {
    const { accessToken } = await ensureConnectionAccessToken(connection);
    const userId = connection.tenantId;

    const params = {
      fields: insightFields.join(','),
      date_preset: datePreset,
      time_increment: '1', // Daily granularity
    };

    const insights = await fetchInsights<GraphInsights>(
      accessToken,
      entityId,
      params,
      userId
    );

    if (!insights || insights.length === 0) {
      logger.debug('No insights data available', { entityType, entityId });
      return 0;
    }

    await Promise.all(
      insights.map(insight => upsertPerformanceSnapshot(entityType, entityId, insight))
    );

    logger.info('Performance data synced', {
      entityType,
      entityId,
      snapshotCount: insights.length,
    });

    return insights.length;
  } catch (error) {
    logger.error('Failed to sync performance data', {
      entityType,
      entityId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

export async function syncAllPerformanceData(
  connection: IMetaConnection,
  datePreset: string = 'last_7d'
): Promise<{ campaigns: number; adSets: number; ads: number }> {
  const accountId = connection.adAccountId;

  // Fetch all entity IDs
  const [campaigns, adSets, ads] = await Promise.all([
    CampaignModel.find({ accountId, status: { $ne: 'ARCHIVED' } })
      .select('campaignId')
      .lean()
      .exec(),
    AdSetModel.find({ accountId, status: { $ne: 'ARCHIVED' } })
      .select('adSetId')
      .lean()
      .exec(),
    AdModel.find({ accountId, status: { $ne: 'ARCHIVED' } })
      .select('adId')
      .lean()
      .exec(),
  ]);

  let campaignSnapshots = 0;
  let adSetSnapshots = 0;
  let adSnapshots = 0;

  // Sync performance data for campaigns
  for (const campaign of campaigns) {
    try {
      const count = await syncPerformanceData(
        connection,
        'CAMPAIGN',
        campaign.campaignId,
        datePreset
      );
      campaignSnapshots += count;
    } catch (error) {
      logger.error('Failed to sync campaign performance', {
        campaignId: campaign.campaignId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // Sync performance data for ad sets
  for (const adSet of adSets) {
    try {
      const count = await syncPerformanceData(
        connection,
        'AD_SET',
        adSet.adSetId,
        datePreset
      );
      adSetSnapshots += count;
    } catch (error) {
      logger.error('Failed to sync ad set performance', {
        adSetId: adSet.adSetId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // Sync performance data for ads
  for (const ad of ads) {
    try {
      const count = await syncPerformanceData(
        connection,
        'AD',
        ad.adId,
        datePreset
      );
      adSnapshots += count;
    } catch (error) {
      logger.error('Failed to sync ad performance', {
        adId: ad.adId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  logger.info('All performance data synced', {
    tenantId: connection.tenantId,
    adAccountId: accountId,
    campaignSnapshots,
    adSetSnapshots,
    adSnapshots,
  });

  return {
    campaigns: campaignSnapshots,
    adSets: adSetSnapshots,
    ads: adSnapshots,
  };
}

export async function syncMetaConnection(connection: IMetaConnection, syncPerformance = false) {
  const syncStartTime = Date.now();
  const { connection: safeConnection, accessToken } = await ensureConnectionAccessToken(connection);
  const accountId = safeConnection.adAccountId;
  const userId = safeConnection.tenantId;

  try {
    // Fetch campaigns, adsets, and ads in parallel for better performance
    const [campaigns, adSets, ads] = await Promise.all([
      fetchGraphEdges<GraphCampaign>(
        accessToken,
        `${accountId}/campaigns`,
        buildGraphEdgeParams(campaignFields),
        userId
      ),
      fetchGraphEdges<GraphAdSet>(
        accessToken,
        `${accountId}/adsets`,
        buildGraphEdgeParams(adSetFields),
        userId
      ),
      fetchGraphEdges<GraphAd>(
        accessToken,
        `${accountId}/ads`,
        buildGraphEdgeParams(adFields),
        userId
      ),
    ]);

    // Build campaign ID map for ad set → campaign relationship
    const campaignIdMap = new Map(campaigns.map(c => [c.id, c.id]));

    // Build ad set → campaign map
    const adSetCampaignMap = new Map(
      adSets.map(as => [as.id, as.campaign_id || ''])
    );

    // Upsert all entities in parallel
    await Promise.all([
      ...campaigns.map((payload) => upsertCampaignFromGraph(payload, accountId)),
      ...adSets.map((payload) => upsertAdSetFromGraph(payload, accountId)),
      ...ads.map((payload) => {
        const campaignId = adSetCampaignMap.get(payload.adset_id || '');
        return upsertAdFromGraph(payload, accountId, campaignId);
      }),
    ]);

    await MetaConnectionModel.findByIdAndUpdate(safeConnection._id, {
      lastSyncedAt: new Date(),
      status: 'ACTIVE',
    }).exec();

    const syncDuration = Date.now() - syncStartTime;

    logger.info('Meta connection synced', {
      tenantId: safeConnection.tenantId,
      adAccountId: accountId,
      campaignCount: campaigns.length,
      adSetCount: adSets.length,
      adCount: ads.length,
      durationMs: syncDuration,
    });

    // Optionally sync performance data
    let performanceStats;
    if (syncPerformance) {
      performanceStats = await syncAllPerformanceData(safeConnection);
    }

    return {
      campaignsSynced: campaigns.length,
      adSetsSynced: adSets.length,
      adsSynced: ads.length,
      durationMs: syncDuration,
      performanceStats,
    };
  } catch (error) {
    // MOCK MODE INTERCEPTION for Sync
    if (accessToken?.includes('mock_') || accessToken === 'mock_access_token_123') {
      logger.warn('MOCK MODE: Simulating sync for mock token', { accountId });
      return {
        campaignsSynced: 0,
        adSetsSynced: 0,
        adsSynced: 0,
        durationMs: Date.now() - syncStartTime,
        performanceStats: { campaigns: 0, adSets: 0, ads: 0 }
      };
    }

    if (error instanceof MetaAPIError) {
      if (error.code === 190) {
        // Token expired - mark connection as expired
        await MetaConnectionModel.findByIdAndUpdate(safeConnection._id, {
          status: 'EXPIRED',
        }).exec();
        logger.error('Meta connection token expired', {
          tenantId: safeConnection.tenantId,
          adAccountId: accountId,
        });
      }
    }

    logger.error('Meta connection sync failed', {
      tenantId: safeConnection.tenantId,
      adAccountId: accountId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    throw error;
  }
}

export async function syncCampaignFromWebhook(connection: IMetaConnection, campaignId: string) {
  try {
    const { accessToken } = await ensureConnectionAccessToken(connection);
    const userId = connection.tenantId;
    const payload = await fetchGraphNode<GraphCampaign>(
      accessToken,
      `${campaignId}`,
      { fields: campaignFields.join(',') },
      userId
    );

    const result = await upsertCampaignFromGraph(payload, connection.adAccountId);

    logger.info('Campaign synced from webhook', {
      tenantId: connection.tenantId,
      campaignId,
    });

    return result;
  } catch (error) {
    logger.error('Failed to sync campaign from webhook', {
      tenantId: connection.tenantId,
      campaignId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

export async function syncAdSetFromWebhook(connection: IMetaConnection, adSetId: string) {
  try {
    const { accessToken } = await ensureConnectionAccessToken(connection);
    const userId = connection.tenantId;
    const payload = await fetchGraphNode<GraphAdSet>(
      accessToken,
      `${adSetId}`,
      { fields: adSetFields.join(',') },
      userId
    );

    const result = await upsertAdSetFromGraph(payload, connection.adAccountId);

    logger.info('Ad set synced from webhook', {
      tenantId: connection.tenantId,
      adSetId,
    });

    return result;
  } catch (error) {
    logger.error('Failed to sync ad set from webhook', {
      tenantId: connection.tenantId,
      adSetId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

export async function syncAdFromWebhook(connection: IMetaConnection, adId: string) {
  try {
    const { accessToken } = await ensureConnectionAccessToken(connection);
    const userId = connection.tenantId;
    const payload = await fetchGraphNode<GraphAd>(
      accessToken,
      `${adId}`,
      { fields: adFields.join(',') },
      userId
    );

    const result = await upsertAdFromGraph(payload, connection.adAccountId);

    logger.info('Ad synced from webhook', {
      tenantId: connection.tenantId,
      adId,
    });

    return result;
  } catch (error) {
    logger.error('Failed to sync ad from webhook', {
      tenantId: connection.tenantId,
      adId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

// --- Push / Mutation Logic ---

function mapTargetingToGraph(targeting?: ITargeting): Record<string, any> {
  if (!targeting) return {};

  const result: Record<string, any> = {
    age_min: targeting.ageMin,
    age_max: targeting.ageMax,
    genders: targeting.genders,
    app_store_audience_size: targeting.audienceSize,
    // Required: Advantage audience flag (0 = disabled, 1 = enabled)
    targeting_automation: {
      advantage_audience: 0, // Disable for manual targeting
    },
  };

  if (targeting.locations && targeting.locations.length > 0) {
    result.geo_locations = {
      countries: targeting.locations,
    };
  }

  if (targeting.interests && targeting.interests.length > 0) {
    // Note: This assumes we store interest IDs or valid names. 
    // In a real app, we might need to resolve names to IDs if we only stored names.
    // For now, passing them structure expecting IDs or compatible objects
    // If we only stored names in the mapTargeting function without IDs, we valid IDs to update.
    // This is a simplification.
  }

  // Custom audiences, lookalikes, etc. need complex mapping involving IDs.
  // Skipped for MVP unless IDs are available.

  return result;
}

export async function pushCampaignToMeta(
  connection: IMetaConnection,
  campaign: ICampaign
): Promise<GraphCampaign> {
  const { accessToken } = await ensureConnectionAccessToken(connection);
  const userId = connection.tenantId;

  const data: Record<string, any> = {
    name: campaign.name,
    status: campaign.status, // ACTIVE, PAUSED, etc. match
    objective: campaign.objective,
    special_ad_categories: [], // Required for v7+ but handled by default usually
  };

  if (campaign.budget) {
    data.daily_budget = campaign.budget.toString();
  }

  // If new campaign (no ID), this would be a creation call (POST to account/campaigns)
  // If existing (has ID), strictly update (POST to campaign_id)

  // Checking if it looks like a Meta ID or a placeholder
  const isExisting = campaign.campaignId && !campaign.campaignId.startsWith('tmp_');
  const edge = isExisting ? '' : 'campaigns'; // Post to ID for update, or account/campaigns for create
  const objectId = isExisting ? campaign.campaignId : connection.adAccountId;

  // MOCK MODE: Intercept before calling Graph API
  if (accessToken.includes('mock_')) {
    logger.warn('MOCK MODE: Simulating Campaign push', { name: campaign.name });
    return {
      id: isExisting ? campaign.campaignId : `cmp_${Math.floor(Math.random() * 1000000)}`,
      name: campaign.name,
      status: campaign.status,
      daily_budget: data.daily_budget,
      objective: campaign.objective
    };
  }

  const result = await postGraphEdge<GraphCampaign>(
    accessToken,
    objectId,
    edge,
    data,
    userId
  );

  return result;
}

export async function pushAdSetToMeta(
  connection: IMetaConnection,
  adSet: IAdSet
): Promise<GraphAdSet> {
  const { accessToken } = await ensureConnectionAccessToken(connection);
  const userId = connection.tenantId;

  const isExisting = adSet.adSetId && !adSet.adSetId.startsWith('tmp_');
  const edge = isExisting ? '' : 'adsets';
  const objectId = isExisting ? adSet.adSetId : connection.adAccountId;

  // Convert budget from dollars to cents (Meta requires cents)
  const budgetInCents = adSet.budget ? Math.round(adSet.budget * 100) : undefined;

  const data: Record<string, any> = {
    name: adSet.name,
    status: adSet.status,
    optimization_goal: adSet.optimizationGoal || 'LINK_CLICKS',
    targeting: mapTargetingToGraph(adSet.targeting),
  };

  // Add budget only if provided (campaign might have budget instead)
  if (budgetInCents) {
    data.daily_budget = budgetInCents.toString();
  }

  // Add optional time fields
  if (adSet.startDate) {
    data.start_time = adSet.startDate.toISOString();
  }
  if (adSet.endDate) {
    data.end_time = adSet.endDate.toISOString();
  }

  // MOCK MODE: Intercept before calling Graph API
  if (accessToken.includes('mock_')) {
    logger.warn('MOCK MODE: Simulating Ad Set push', { name: adSet.name });
    return {
      id: isExisting ? adSet.adSetId : `adj_${Math.floor(Math.random() * 1000000)}`,
      name: adSet.name,
      status: adSet.status,
      daily_budget: data.daily_budget,
      campaign_id: adSet.campaignId || 'mock_campaign_id'
    };
  }

  // If creating a new ad set, add required fields
  if (!isExisting) {
    if (!adSet.campaignId) {
      throw new Error('campaign_id is required for creating a new ad set');
    }
    // Note: budget is optional - campaign might have budget instead

    data.campaign_id = adSet.campaignId;

    // Match billing_event to optimization_goal for consistency
    // For LINK_CLICKS optimization, use LINK_CLICKS billing
    const optimizationGoal = adSet.optimizationGoal || 'LINK_CLICKS';
    if (optimizationGoal === 'LINK_CLICKS') {
      data.billing_event = 'LINK_CLICKS';
      // Set a reasonable bid amount (in cents) - e.g., $0.50 per click
      data.bid_amount = 50; // 50 cents per click
    } else {
      data.billing_event = 'IMPRESSIONS';
      // For impressions, bid per 1000 impressions (CPM)
      data.bid_amount = 500; // $5 CPM
    }

    // Promoted object is sometimes required depending on optimization goal
    // For LINK_CLICKS, we don't need it, but for other goals we might
    if (adSet.optimizationGoal === 'PAGE_LIKES') {
      // Would need page_id here
      logger.warn('PAGE_LIKES optimization goal requires promoted_object with page_id');
    }
  }

  logger.info('Pushing Ad Set to Meta', {
    isExisting,
    adSetId: adSet.adSetId,
    campaignId: adSet.campaignId,
    budgetInCents
  });

  const result = await postGraphEdge<GraphAdSet>(
    accessToken,
    objectId,
    edge,
    data,
    userId
  );

  return result;
}

export async function pushAdToMeta(
  connection: IMetaConnection,
  ad: IAd
): Promise<GraphAd> {
  const { accessToken } = await ensureConnectionAccessToken(connection);
  const userId = connection.tenantId;

  const isExisting = ad.adId && !ad.adId.startsWith('tmp_');
  const edge = isExisting ? '' : 'ads'; // Post to ID for update, or account/ads for create
  const objectId = isExisting ? ad.adId : connection.adAccountId;

  const data: Record<string, any> = {
    name: ad.name,
    status: ad.status,
    adset_id: ad.adSetId,
    creative: { creative_id: ad.creative?.creativeId },
  };

  if (!data.creative.creative_id && !accessToken.includes('mock_')) {
    throw new Error('Creative ID is required to create an ad');
  }

  // MOCK MODE: Intercept before calling Graph API
  if (accessToken.includes('mock_')) {
    logger.warn('MOCK MODE: Simulating Ad push', { name: ad.name });
    return {
      id: isExisting ? ad.adId : `ad_${Math.floor(Math.random() * 1000000)}`,
      name: ad.name,
      status: ad.status,
      adset_id: ad.adSetId,
      creative: { id: ad.creative?.creativeId || 'mock_creative_id' }
    };
  }

  if (!isExisting && !data.adset_id) {
    throw new Error('Ad Set ID is required to create a new ad');
  }

  const result = await postGraphEdge<GraphAd>(
    accessToken,
    objectId,
    edge,
    data,
    userId
  );

  return result;
}

export async function pushEntityToMeta(
  connection: IMetaConnection,
  type: 'CAMPAIGN' | 'AD_SET' | 'AD',
  entity: ICampaign | IAdSet | IAd
) {
  switch (type) {
    case 'CAMPAIGN':
      return pushCampaignToMeta(connection, entity as ICampaign);
    case 'AD_SET':
      return pushAdSetToMeta(connection, entity as IAdSet);
    case 'AD':
      return pushAdToMeta(connection, entity as IAd);
    default:
      throw new Error(`Unsupported entity type: ${type}`);
  }
}
