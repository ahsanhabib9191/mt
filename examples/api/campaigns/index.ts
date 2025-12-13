/**
 * Next.js API Route: Campaign Management
 * 
 * GET    /api/campaigns       - List all campaigns
 * POST   /api/campaigns       - Create new campaign
 * 
 * Manages Meta ad campaigns for authenticated tenant
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { connectDB } from '../../../lib/db/client';
import { getAccessToken } from '../../../lib/services/meta-oauth/oauth-service';
import { fetchGraphEdges, fetchGraphNode } from '../../../lib/services/meta-sync/graph-client';
import { CampaignModel } from '../../../lib/db/models/campaign';
import { z } from 'zod';
import logger from '../../../lib/utils/logger';

// Validation schemas
const CreateCampaignSchema = z.object({
  name: z.string().min(1).max(255),
  objective: z.enum([
    'OUTCOME_AWARENESS',
    'OUTCOME_ENGAGEMENT',
    'OUTCOME_LEADS',
    'OUTCOME_SALES',
    'OUTCOME_TRAFFIC',
    'OUTCOME_APP_PROMOTION',
  ]),
  status: z.enum(['ACTIVE', 'PAUSED']).default('PAUSED'),
  dailyBudget: z.number().min(1).optional(),
  lifetimeBudget: z.number().min(1).optional(),
  specialAdCategories: z.array(z.string()).optional(),
});

const ListCampaignsSchema = z.object({
  adAccountId: z.string(),
  status: z.enum(['ACTIVE', 'PAUSED', 'ARCHIVED']).optional(),
  limit: z.coerce.number().min(1).max(100).default(25),
  page: z.coerce.number().min(1).default(1),
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    // Connect to database
    await connectDB();

    // Get tenant ID from session/auth
    // In production, get from authenticated session
    const tenantId = req.query.tenant as string || req.headers['x-tenant-id'] as string;
    
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Tenant ID required' });
    }

    if (req.method === 'GET') {
      return handleListCampaigns(req, res, tenantId);
    } else if (req.method === 'POST') {
      return handleCreateCampaign(req, res, tenantId);
    } else {
      res.setHeader('Allow', ['GET', 'POST']);
      return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    logger.error('Campaign API error', { error, method: req.method });
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * GET /api/campaigns - List campaigns
 */
async function handleListCampaigns(
  req: NextApiRequest,
  res: NextApiResponse,
  tenantId: string
) {
  try {
    // Validate query parameters
    const params = ListCampaignsSchema.parse(req.query);

    // Get access token
    const accessToken = await getAccessToken(tenantId, params.adAccountId);

    // Fetch campaigns from Meta
    const fields = [
      'id',
      'name',
      'status',
      'objective',
      'daily_budget',
      'lifetime_budget',
      'start_time',
      'stop_time',
      'created_time',
      'updated_time',
    ].join(',');

    const campaigns = await fetchGraphEdges<any>(
      `act_${params.adAccountId}/campaigns`,
      accessToken,
      { fields, limit: params.limit.toString() }
    );

    // Filter by status if specified
    let filteredCampaigns = campaigns;
    if (params.status) {
      filteredCampaigns = campaigns.filter((c: any) => c.status === params.status);
    }

    // Sync to database (async, don't wait)
    syncCampaignsToDatabase(filteredCampaigns, params.adAccountId).catch(err => {
      logger.error('Failed to sync campaigns to database', { error: err });
    });

    // Return response
    return res.status(200).json({
      success: true,
      data: filteredCampaigns.map((campaign: any) => ({
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        objective: campaign.objective,
        dailyBudget: campaign.daily_budget ? parseFloat(campaign.daily_budget) : null,
        lifetimeBudget: campaign.lifetime_budget ? parseFloat(campaign.lifetime_budget) : null,
        startTime: campaign.start_time,
        stopTime: campaign.stop_time,
        createdTime: campaign.created_time,
        updatedTime: campaign.updated_time,
      })),
      pagination: {
        page: params.page,
        limit: params.limit,
        total: filteredCampaigns.length,
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
 * POST /api/campaigns - Create campaign
 */
async function handleCreateCampaign(
  req: NextApiRequest,
  res: NextApiResponse,
  tenantId: string
) {
  try {
    // Validate request body
    const body = CreateCampaignSchema.parse(req.body);
    const adAccountId = req.query.adAccountId as string;

    if (!adAccountId) {
      return res.status(400).json({ error: 'adAccountId query parameter required' });
    }

    // Validate budget
    if (!body.dailyBudget && !body.lifetimeBudget) {
      return res.status(400).json({
        error: 'Either dailyBudget or lifetimeBudget must be specified',
      });
    }

    // Get access token
    const accessToken = await getAccessToken(tenantId, adAccountId);

    // Create campaign on Meta
    const campaignData: any = {
      name: body.name,
      objective: body.objective,
      status: body.status,
      special_ad_categories: body.specialAdCategories || [],
    };

    if (body.dailyBudget) {
      campaignData.daily_budget = (body.dailyBudget * 100).toString(); // Convert to cents
    }

    if (body.lifetimeBudget) {
      campaignData.lifetime_budget = (body.lifetimeBudget * 100).toString();
    }

    const response = await fetch(
      `https://graph.facebook.com/v24.0/act_${adAccountId}/campaigns`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(campaignData),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      logger.error('Meta API error creating campaign', { error });
      return res.status(response.status).json({
        error: 'Failed to create campaign',
        details: error,
      });
    }

    const createdCampaign = await response.json();

    // Fetch full campaign details
    const fullCampaign = await fetchGraphNode<any>(
      createdCampaign.id,
      accessToken,
      {
        fields: 'id,name,status,objective,daily_budget,lifetime_budget,created_time',
      }
    );

    // Save to database
    await CampaignModel.findOneAndUpdate(
      { campaignId: fullCampaign.id },
      {
        campaignId: fullCampaign.id,
        accountId: adAccountId,
        name: fullCampaign.name,
        objective: fullCampaign.objective,
        status: fullCampaign.status,
        budget: fullCampaign.daily_budget
          ? parseFloat(fullCampaign.daily_budget) / 100
          : parseFloat(fullCampaign.lifetime_budget || '0') / 100,
      },
      { upsert: true, new: true }
    );

    logger.info('Campaign created successfully', {
      campaignId: fullCampaign.id,
      tenantId,
      adAccountId,
    });

    return res.status(201).json({
      success: true,
      data: {
        id: fullCampaign.id,
        name: fullCampaign.name,
        status: fullCampaign.status,
        objective: fullCampaign.objective,
        dailyBudget: fullCampaign.daily_budget
          ? parseFloat(fullCampaign.daily_budget) / 100
          : null,
        lifetimeBudget: fullCampaign.lifetime_budget
          ? parseFloat(fullCampaign.lifetime_budget) / 100
          : null,
        createdTime: fullCampaign.created_time,
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
 * Sync campaigns to database
 */
async function syncCampaignsToDatabase(campaigns: any[], adAccountId: string) {
  const syncPromises = campaigns.map(campaign =>
    CampaignModel.findOneAndUpdate(
      { campaignId: campaign.id },
      {
        campaignId: campaign.id,
        accountId: adAccountId,
        name: campaign.name,
        objective: campaign.objective || 'OUTCOME_TRAFFIC',
        status: campaign.status || 'PAUSED',
        budget: campaign.daily_budget
          ? parseFloat(campaign.daily_budget) / 100
          : campaign.lifetime_budget
          ? parseFloat(campaign.lifetime_budget) / 100
          : 0,
        startDate: campaign.start_time ? new Date(campaign.start_time) : undefined,
        endDate: campaign.stop_time ? new Date(campaign.stop_time) : undefined,
      },
      { upsert: true, new: true }
    )
  );

  await Promise.all(syncPromises);
  logger.info('Campaigns synced to database', { count: campaigns.length, adAccountId });
}
