/**
 * Next.js API Route: Single Ad Management
 * 
 * GET    /api/ads/[id]  - Get ad details
 * PATCH  /api/ads/[id]  - Update ad
 * DELETE /api/ads/[id]  - Delete ad (archive)
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { connectDB } from '../../../lib/db/client';
import { getAccessToken } from '../../../lib/services/meta-oauth/oauth-service';
import { fetchGraphNode } from '../../../lib/services/meta-sync/graph-client';
import { AdModel } from '../../../lib/db/models/ad';
import { z } from 'zod';
import logger from '../../../lib/utils/logger';

const UpdateAdSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  status: z.enum(['ACTIVE', 'PAUSED', 'ARCHIVED']).optional(),
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    await connectDB();

    const tenantId = req.query.tenant as string || req.headers['x-tenant-id'] as string;
    const adId = req.query.id as string;
    const adAccountId = req.query.adAccountId as string;

    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!adId) {
      return res.status(400).json({ error: 'Ad ID required' });
    }

    if (req.method === 'GET') {
      return handleGetAd(req, res, tenantId, adId, adAccountId);
    } else if (req.method === 'PATCH') {
      return handleUpdateAd(req, res, tenantId, adId, adAccountId);
    } else if (req.method === 'DELETE') {
      return handleDeleteAd(req, res, tenantId, adId, adAccountId);
    } else {
      res.setHeader('Allow', ['GET', 'PATCH', 'DELETE']);
      return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    logger.error('Ad API error', { error, method: req.method });
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function handleGetAd(
  req: NextApiRequest,
  res: NextApiResponse,
  tenantId: string,
  adId: string,
  adAccountId?: string
) {
  const accessToken = await getAccessToken(tenantId, adAccountId);

  const ad = await fetchGraphNode<any>(adId, accessToken, {
    fields: 'id,name,status,effective_status,adset_id,campaign_id,creative,created_time,updated_time',
  });

  return res.status(200).json({
    success: true,
    data: ad,
  });
}

async function handleUpdateAd(
  req: NextApiRequest,
  res: NextApiResponse,
  tenantId: string,
  adId: string,
  adAccountId?: string
) {
  const body = UpdateAdSchema.parse(req.body);
  const accessToken = await getAccessToken(tenantId, adAccountId);

  const response = await fetch(
    `https://graph.facebook.com/v24.0/${adId}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    return res.status(response.status).json({
      error: 'Failed to update ad',
      details: error,
    });
  }

  await AdModel.findOneAndUpdate({ adId }, body, { new: true });

  logger.info('Ad updated', { adId, tenantId });

  return res.status(200).json({
    success: true,
    message: 'Ad updated successfully',
  });
}

async function handleDeleteAd(
  req: NextApiRequest,
  res: NextApiResponse,
  tenantId: string,
  adId: string,
  adAccountId?: string
) {
  const accessToken = await getAccessToken(tenantId, adAccountId);

  const response = await fetch(
    `https://graph.facebook.com/v24.0/${adId}`,
    {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.json();
    return res.status(response.status).json({
      error: 'Failed to delete ad',
      details: error,
    });
  }

  await AdModel.findOneAndUpdate({ adId }, { status: 'ARCHIVED' });

  logger.info('Ad deleted', { adId, tenantId });

  return res.status(200).json({
    success: true,
    message: 'Ad deleted successfully',
  });
}
