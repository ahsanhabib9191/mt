import { logger } from '../../utils/logger';

const META_API_VERSION = process.env.META_API_VERSION || 'v21.0';
const META_API_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

export type UserLevel = 'newbie' | 'growing' | 'pro';

export interface PixelAnalysisResult {
  userLevel: UserLevel;
  pixelId: string;
  pixelName?: string;
  isActive: boolean;
  lastFiredTime?: string;
  eventCounts: Record<string, number>;
  totalEvents: number;
  hasPurchaseEvents: boolean;
  hasAddToCartEvents: boolean;
  hasViewContentEvents: boolean;
  recommendedObjective: string;
  recommendedOptimizationGoal: string;
  recommendations: string[];
  audiencesAvailable: {
    retargeting: boolean;
    lookalike: boolean;
    customAudience: boolean;
  };
  capiStatus: {
    detected: boolean;
    eventMatchQuality?: number;
  };
}

interface MetaApiResponse {
  data?: any[];
  error?: { message: string; code?: number };
  [key: string]: any;
}

async function metaApiRequest(endpoint: string, accessToken: string): Promise<MetaApiResponse> {
  const url = `${META_API_BASE}${endpoint}`;
  const separator = url.includes('?') ? '&' : '?';
  const fullUrl = `${url}${separator}access_token=${accessToken}`;

  try {
    const response = await fetch(fullUrl);
    if (!response.ok) {
      const errorData = await response.json().catch(() => null) as MetaApiResponse | null;
      return { error: { message: errorData?.error?.message || `HTTP ${response.status}`, code: response.status } };
    }
    return response.json() as Promise<MetaApiResponse>;
  } catch (err) {
    return { error: { message: 'Network error connecting to Meta API' } };
  }
}

function determineUserLevel(totalEvents: number, hasPurchase: boolean, hasAddToCart: boolean): UserLevel {
  if (hasPurchase && totalEvents >= 500) {
    return 'pro';
  }
  if ((hasAddToCart || totalEvents >= 100) && totalEvents < 500) {
    return 'growing';
  }
  return 'newbie';
}

function getRecommendedObjective(userLevel: UserLevel, hasPurchase: boolean): string {
  switch (userLevel) {
    case 'pro':
      return 'OUTCOME_SALES';
    case 'growing':
      return hasPurchase ? 'OUTCOME_SALES' : 'OUTCOME_ENGAGEMENT';
    case 'newbie':
    default:
      return 'OUTCOME_TRAFFIC';
  }
}

function getRecommendedOptimizationGoal(eventCounts: Record<string, number>): string {
  if (eventCounts['Purchase'] && eventCounts['Purchase'] >= 50) {
    return 'PURCHASE';
  }
  if (eventCounts['AddToCart'] && eventCounts['AddToCart'] >= 50) {
    return 'ADD_TO_CART';
  }
  if (eventCounts['ViewContent'] && eventCounts['ViewContent'] >= 100) {
    return 'VIEW_CONTENT';
  }
  if (eventCounts['Lead'] && eventCounts['Lead'] >= 30) {
    return 'LEAD';
  }
  return 'LINK_CLICKS';
}

function generateRecommendations(userLevel: UserLevel, eventCounts: Record<string, number>, capiDetected: boolean): string[] {
  const recommendations: string[] = [];

  if (userLevel === 'newbie') {
    recommendations.push('Start with Traffic campaigns to build pixel data');
    recommendations.push('Focus on driving website visitors to warm up your pixel');
    if (!capiDetected) {
      recommendations.push('Consider setting up Conversions API (CAPI) for better tracking');
    }
  }

  if (userLevel === 'growing') {
    recommendations.push('Your pixel is learning! Consider engagement campaigns');
    if (!eventCounts['Purchase'] || eventCounts['Purchase'] < 50) {
      recommendations.push('Need 50+ Purchase events to optimize for conversions');
    }
    recommendations.push('Build Custom Audiences from your website visitors');
  }

  if (userLevel === 'pro') {
    recommendations.push('Optimize for Purchase - your pixel has enough data');
    recommendations.push('Create Lookalike audiences from your purchasers');
    recommendations.push('Test value-based Lookalikes for higher ROAS');
  }

  if (!capiDetected) {
    recommendations.push('Set up CAPI to improve iOS 14+ tracking accuracy');
  }

  return recommendations;
}

export async function analyzePixel(
  pixelId: string,
  accessToken: string
): Promise<PixelAnalysisResult | null> {
  try {
    logger.info('Analyzing pixel', { pixelId });

    const pixelResponse = await metaApiRequest(
      `/${pixelId}?fields=id,name,last_fired_time,is_unavailable,first_party_cookie_status`,
      accessToken
    );

    if (pixelResponse.error) {
      logger.warn('Failed to fetch pixel info', { pixelId, error: pixelResponse.error.message });
      return null;
    }

    const now = Math.floor(Date.now() / 1000);
    const last30Days = now - (30 * 24 * 60 * 60);

    const statsResponse = await metaApiRequest(
      `/${pixelId}/stats?start_time=${last30Days}&end_time=${now}&aggregation=event`,
      accessToken
    );

    const eventCounts: Record<string, number> = {};
    let totalEvents = 0;

    if (statsResponse.data && Array.isArray(statsResponse.data)) {
      for (const stat of statsResponse.data) {
        const eventName = stat.event || stat.name;
        const count = stat.count || stat.value || 0;
        if (eventName) {
          eventCounts[eventName] = (eventCounts[eventName] || 0) + count;
          totalEvents += count;
        }
      }
    }

    const hasPurchaseEvents = (eventCounts['Purchase'] || 0) > 0;
    const hasAddToCartEvents = (eventCounts['AddToCart'] || 0) > 0;
    const hasViewContentEvents = (eventCounts['ViewContent'] || 0) > 0;

    const userLevel = determineUserLevel(totalEvents, hasPurchaseEvents, hasAddToCartEvents);
    const recommendedObjective = getRecommendedObjective(userLevel, hasPurchaseEvents);
    const recommendedOptimizationGoal = getRecommendedOptimizationGoal(eventCounts);

    const capiDetected = eventCounts['PageView'] && totalEvents > 0;

    const recommendations = generateRecommendations(userLevel, eventCounts, !!capiDetected);

    const result: PixelAnalysisResult = {
      userLevel,
      pixelId,
      pixelName: pixelResponse.name,
      isActive: !pixelResponse.is_unavailable,
      lastFiredTime: pixelResponse.last_fired_time,
      eventCounts,
      totalEvents,
      hasPurchaseEvents,
      hasAddToCartEvents,
      hasViewContentEvents,
      recommendedObjective,
      recommendedOptimizationGoal,
      recommendations,
      audiencesAvailable: {
        retargeting: totalEvents >= 100,
        lookalike: hasPurchaseEvents && (eventCounts['Purchase'] || 0) >= 100,
        customAudience: totalEvents >= 1000,
      },
      capiStatus: {
        detected: !!capiDetected,
      },
    };

    logger.info('Pixel analysis complete', {
      pixelId,
      userLevel,
      totalEvents,
      hasPurchaseEvents,
    });

    return result;
  } catch (error) {
    logger.error('Pixel analysis failed', { pixelId, error });
    return null;
  }
}

export function getSmartDefaults(userLevel: UserLevel, eventCounts: Record<string, number>) {
  const defaults = {
    objective: getRecommendedObjective(userLevel, (eventCounts['Purchase'] || 0) > 0),
    optimizationGoal: getRecommendedOptimizationGoal(eventCounts),
    bidStrategy: userLevel === 'pro' ? 'LOWEST_COST_WITH_BID_CAP' : 'LOWEST_COST_WITHOUT_CAP',
    suggestedBudget: userLevel === 'newbie' ? 10 : userLevel === 'growing' ? 20 : 50,
    audienceExpansion: userLevel !== 'pro',
  };

  return defaults;
}
