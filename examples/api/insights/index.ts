/**
 * Next.js API Route: Performance Insights
 * 
 * GET /api/insights - Get performance metrics
 * 
 * Supports insights for campaigns, ad sets, and ads
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { connectDB } from '../../../lib/db/client';
import { getAccessToken } from '../../../lib/services/meta-oauth/oauth-service';
import { z } from 'zod';
import logger from '../../../lib/utils/logger';

const InsightsSchema = z.object({
  objectId: z.string(), // Campaign, AdSet, or Ad ID
  level: z.enum(['campaign', 'adset', 'ad']).default('campaign'),
  datePreset: z.enum([
    'today',
    'yesterday',
    'this_week',
    'last_week',
    'this_month',
    'last_month',
    'last_7d',
    'last_14d',
    'last_30d',
    'last_90d',
    'lifetime',
  ]).optional(),
  timeRange: z.object({
    since: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
    until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }).optional(),
  breakdowns: z.array(z.enum([
    'age',
    'gender',
    'country',
    'region',
    'dma',
    'placement',
    'device_platform',
    'publisher_platform',
  ])).optional(),
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    await connectDB();

    const tenantId = req.query.tenant as string || req.headers['x-tenant-id'] as string;
    const adAccountId = req.query.adAccountId as string;

    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (req.method !== 'GET') {
      res.setHeader('Allow', ['GET']);
      return res.status(405).json({ error: 'Method not allowed' });
    }

    return handleGetInsights(req, res, tenantId, adAccountId);
  } catch (error) {
    logger.error('Insights API error', { error });
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * GET /api/insights - Get insights
 */
async function handleGetInsights(
  req: NextApiRequest,
  res: NextApiResponse,
  tenantId: string,
  adAccountId?: string
) {
  try {
    const params = InsightsSchema.parse(req.query);
    const accessToken = await getAccessToken(tenantId, adAccountId);

    // Build insights URL
    const insightsUrl = new URL(
      `https://graph.facebook.com/v24.0/${params.objectId}/insights`
    );

    // Add fields - comprehensive metrics
    const fields = [
      'impressions',
      'clicks',
      'spend',
      'reach',
      'frequency',
      'ctr',
      'cpc',
      'cpm',
      'cpp',
      'cost_per_unique_click',
      'actions',
      'action_values',
      'conversions',
      'conversion_values',
      'cost_per_action_type',
      'cost_per_conversion',
      'video_avg_time_watched_actions',
      'video_p25_watched_actions',
      'video_p50_watched_actions',
      'video_p75_watched_actions',
      'video_p100_watched_actions',
    ].join(',');

    insightsUrl.searchParams.set('fields', fields);
    insightsUrl.searchParams.set('access_token', accessToken);

    // Add time range
    if (params.datePreset) {
      insightsUrl.searchParams.set('date_preset', params.datePreset);
    } else if (params.timeRange) {
      insightsUrl.searchParams.set('time_range', JSON.stringify(params.timeRange));
    } else {
      // Default to last 7 days
      insightsUrl.searchParams.set('date_preset', 'last_7d');
    }

    // Add breakdowns if specified
    if (params.breakdowns && params.breakdowns.length > 0) {
      insightsUrl.searchParams.set('breakdowns', params.breakdowns.join(','));
    }

    // Fetch insights
    const response = await fetch(insightsUrl.toString());

    if (!response.ok) {
      const error = await response.json();
      logger.error('Meta API error fetching insights', { error });
      return res.status(response.status).json({
        error: 'Failed to fetch insights',
        details: error,
      });
    }

    const data = await response.json();

    // Process and format insights
    const insights = data.data.map((item: any) => ({
      dateStart: item.date_start,
      dateStop: item.date_stop,
      
      // Delivery metrics
      impressions: parseInt(item.impressions || '0'),
      reach: parseInt(item.reach || '0'),
      frequency: parseFloat(item.frequency || '0'),
      
      // Engagement metrics
      clicks: parseInt(item.clicks || '0'),
      ctr: parseFloat(item.ctr || '0'),
      
      // Cost metrics
      spend: parseFloat(item.spend || '0'),
      cpc: parseFloat(item.cpc || '0'),
      cpm: parseFloat(item.cpm || '0'),
      cpp: parseFloat(item.cpp || '0'),
      costPerUniqueClick: parseFloat(item.cost_per_unique_click || '0'),
      
      // Conversion metrics
      actions: formatActions(item.actions),
      actionValues: formatActions(item.action_values),
      conversions: formatActions(item.conversions),
      conversionValues: formatActions(item.conversion_values),
      costPerAction: formatActions(item.cost_per_action_type),
      costPerConversion: formatActions(item.cost_per_conversion),
      
      // Video metrics (if applicable)
      videoMetrics: {
        avgTimeWatched: formatActions(item.video_avg_time_watched_actions),
        p25Watched: formatActions(item.video_p25_watched_actions),
        p50Watched: formatActions(item.video_p50_watched_actions),
        p75Watched: formatActions(item.video_p75_watched_actions),
        p100Watched: formatActions(item.video_p100_watched_actions),
      },
      
      // Breakdown dimensions (if any)
      ...(params.breakdowns && {
        breakdowns: params.breakdowns.reduce((acc, breakdown) => ({
          ...acc,
          [breakdown]: item[breakdown],
        }), {}),
      }),
    }));

    // Calculate aggregated metrics if multiple rows
    const aggregated = calculateAggregated(insights);

    logger.info('Insights fetched successfully', {
      objectId: params.objectId,
      level: params.level,
      rows: insights.length,
    });

    return res.status(200).json({
      success: true,
      data: {
        insights,
        aggregated,
        metadata: {
          objectId: params.objectId,
          level: params.level,
          datePreset: params.datePreset,
          timeRange: params.timeRange,
          breakdowns: params.breakdowns,
        },
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors,
      });
    }
    throw error;
  }
}

/**
 * Format actions array from Meta API
 */
function formatActions(actions?: any[]): Record<string, number> {
  if (!actions || !Array.isArray(actions)) return {};
  
  return actions.reduce((acc, action) => ({
    ...acc,
    [action.action_type]: parseFloat(action.value || '0'),
  }), {});
}

/**
 * Calculate aggregated metrics across all insights
 */
function calculateAggregated(insights: any[]) {
  if (insights.length === 0) return null;
  if (insights.length === 1) return insights[0];

  const totals = insights.reduce((acc, insight) => ({
    impressions: acc.impressions + insight.impressions,
    reach: acc.reach + insight.reach,
    clicks: acc.clicks + insight.clicks,
    spend: acc.spend + insight.spend,
  }), {
    impressions: 0,
    reach: 0,
    clicks: 0,
    spend: 0,
  });

  return {
    ...totals,
    frequency: totals.reach > 0 ? totals.impressions / totals.reach : 0,
    ctr: totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0,
    cpc: totals.clicks > 0 ? totals.spend / totals.clicks : 0,
    cpm: totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : 0,
  };
}
