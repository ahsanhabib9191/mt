/**
 * Next.js API Route: Single Campaign Management
 * 
 * GET    /api/campaigns/[id]  - Get campaign details
 * PATCH  /api/campaigns/[id]  - Update campaign
 * DELETE /api/campaigns/[id]  - Delete campaign (archive)
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { connectDB } from '../../../lib/db/client';
import { getAccessToken } from '../../../lib/services/meta-oauth/oauth-service';
import { fetchGraphNode } from '../../../lib/services/meta-sync/graph-client';
import { CampaignModel } from '../../../lib/db/models/campaign';
import { z } from 'zod';
import logger from '../../../lib/utils/logger';

const UpdateCampaignSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  status: z.enum(['ACTIVE', 'PAUSED', 'ARCHIVED']).optional(),
  dailyBudget: z.number().min(1).optional(),
  lifetimeBudget: z.number().min(1).optional(),
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    await connectDB();

    const tenantId = req.query.tenant as string || req.headers['x-tenant-id'] as string;
    const campaignId = req.query.id as string;
    const adAccountId = req.query.adAccountId as string;

    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!campaignId) {
      return res.status(400).json({ error: 'Campaign ID required' });
    }

    if (req.method === 'GET') {
      return handleGetCampaign(req, res, tenantId, campaignId, adAccountId);
    } else if (req.method === 'PATCH') {
      return handleUpdateCampaign(req, res, tenantId, campaignId, adAccountId);
    } else if (req.method === 'DELETE') {
      return handleDeleteCampaign(req, res, tenantId, campaignId, adAccountId);
    } else {
      res.setHeader('Allow', ['GET', 'PATCH', 'DELETE']);
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
 * GET /api/campaigns/[id] - Get campaign
 */
async function handleGetCampaign(
  req: NextApiRequest,
  res: NextApiResponse,
  tenantId: string,
  campaignId: string,
  adAccountId?: string
) {
  const accessToken = await getAccessToken(tenantId, adAccountId);

  const campaign = await fetchGraphNode<any>(campaignId, accessToken, {
    fields: [
      'id',
      'name',
      'status',
      'objective',
      'daily_budget',
      'lifetime_budget',
      'budget_remaining',
      'start_time',
      'stop_time',
      'created_time',
      'updated_time',
    ].join(','),
  });

  return res.status(200).json({
    success: true,
    data: {
      id: campaign.id,
      name: campaign.name,
      status: campaign.status,
      objective: campaign.objective,
      dailyBudget: campaign.daily_budget ? parseFloat(campaign.daily_budget) / 100 : null,
      lifetimeBudget: campaign.lifetime_budget ? parseFloat(campaign.lifetime_budget) / 100 : null,
      budgetRemaining: campaign.budget_remaining ? parseFloat(campaign.budget_remaining) / 100 : null,
      startTime: campaign.start_time,
      stopTime: campaign.stop_time,
      createdTime: campaign.created_time,
      updatedTime: campaign.updated_time,
    },
  });
}

/**
 * PATCH /api/campaigns/[id] - Update campaign
 */
async function handleUpdateCampaign(
  req: NextApiRequest,
  res: NextApiResponse,
  tenantId: string,
  campaignId: string,
  adAccountId?: string
) {
  const body = UpdateCampaignSchema.parse(req.body);
  const accessToken = await getAccessToken(tenantId, adAccountId);

  const updates: any = {};
  if (body.name) updates.name = body.name;
  if (body.status) updates.status = body.status;
  if (body.dailyBudget) updates.daily_budget = (body.dailyBudget * 100).toString();
  if (body.lifetimeBudget) updates.lifetime_budget = (body.lifetimeBudget * 100).toString();

  const response = await fetch(
    `https://graph.facebook.com/v24.0/${campaignId}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    return res.status(response.status).json({
      error: 'Failed to update campaign',
      details: error,
    });
  }

  const result = await response.json();

  // Update database
  await CampaignModel.findOneAndUpdate(
    { campaignId },
    { ...body },
    { new: true }
  );

  logger.info('Campaign updated', { campaignId, tenantId, updates });

  return res.status(200).json({
    success: true,
    data: { id: campaignId, ...result },
  });
}

/**
 * DELETE /api/campaigns/[id] - Archive campaign
 */
async function handleDeleteCampaign(
  req: NextApiRequest,
  res: NextApiResponse,
  tenantId: string,
  campaignId: string,
  adAccountId?: string
) {
  const accessToken = await getAccessToken(tenantId, adAccountId);

  // Archive campaign on Meta (can't truly delete)
  const response = await fetch(
    `https://graph.facebook.com/v24.0/${campaignId}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'ARCHIVED' }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    return res.status(response.status).json({
      error: 'Failed to archive campaign',
      details: error,
    });
  }

  // Update database
  await CampaignModel.findOneAndUpdate(
    { campaignId },
    { status: 'ARCHIVED' },
    { new: true }
  );

  logger.info('Campaign archived', { campaignId, tenantId });

  return res.status(200).json({
    success: true,
    message: 'Campaign archived successfully',
  });
}
