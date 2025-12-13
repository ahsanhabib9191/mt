/**
 * Next.js API Route: Ad Management
 * 
 * GET  /api/ads       - List ads
 * POST /api/ads       - Create new ad
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { connectDB } from '../../../lib/db/client';
import { getAccessToken } from '../../../lib/services/meta-oauth/oauth-service';
import { fetchGraphEdges } from '../../../lib/services/meta-sync/graph-client';
import { AdModel } from '../../../lib/db/models/ad';
import { z } from 'zod';
import logger from '../../../lib/utils/logger';

const ListAdsSchema = z.object({
  adAccountId: z.string(),
  adsetId: z.string().optional(),
  campaignId: z.string().optional(),
  status: z.enum(['ACTIVE', 'PAUSED', 'ARCHIVED']).optional(),
  limit: z.coerce.number().min(1).max(100).default(25),
});

const CreateAdSchema = z.object({
  adsetId: z.string(),
  name: z.string().min(1).max(255),
  status: z.enum(['ACTIVE', 'PAUSED']).default('PAUSED'),
  creative: z.object({
    name: z.string(),
    objectStorySpec: z.object({
      pageId: z.string(),
      linkData: z.object({
        message: z.string().optional(),
        link: z.string().url(),
        caption: z.string().optional(),
        description: z.string().optional(),
        imageHash: z.string().optional(),
        name: z.string().optional(), // Headline
        callToAction: z.object({
          type: z.enum([
            'LEARN_MORE',
            'SHOP_NOW',
            'SIGN_UP',
            'BOOK_TRAVEL',
            'CONTACT_US',
            'DOWNLOAD',
            'GET_QUOTE',
            'APPLY_NOW',
            'SUBSCRIBE',
          ]),
          value: z.object({
            link: z.string().url().optional(),
          }).optional(),
        }).optional(),
      }),
    }),
  }),
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    await connectDB();

    const tenantId = req.query.tenant as string || req.headers['x-tenant-id'] as string;

    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (req.method === 'GET') {
      return handleListAds(req, res, tenantId);
    } else if (req.method === 'POST') {
      return handleCreateAd(req, res, tenantId);
    } else {
      res.setHeader('Allow', ['GET', 'POST']);
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

/**
 * GET /api/ads - List ads
 */
async function handleListAds(
  req: NextApiRequest,
  res: NextApiResponse,
  tenantId: string
) {
  const params = ListAdsSchema.parse(req.query);
  const accessToken = await getAccessToken(tenantId, params.adAccountId);

  let endpoint = `act_${params.adAccountId}/ads`;
  
  // Filter by adset or campaign if provided
  if (params.adsetId) {
    endpoint = `${params.adsetId}/ads`;
  } else if (params.campaignId) {
    endpoint = `${params.campaignId}/ads`;
  }

  const fields = [
    'id',
    'name',
    'status',
    'effective_status',
    'adset_id',
    'campaign_id',
    'creative',
    'tracking_specs',
    'created_time',
    'updated_time',
  ].join(',');

  const ads = await fetchGraphEdges<any>(endpoint, accessToken, {
    fields,
    limit: params.limit.toString(),
  });

  // Filter by status if specified
  let filteredAds = ads;
  if (params.status) {
    filteredAds = ads.filter((ad: any) => ad.status === params.status);
  }

  return res.status(200).json({
    success: true,
    data: filteredAds.map((ad: any) => ({
      id: ad.id,
      name: ad.name,
      status: ad.status,
      effectiveStatus: ad.effective_status,
      adsetId: ad.adset_id,
      campaignId: ad.campaign_id,
      creative: ad.creative,
      createdTime: ad.created_time,
      updatedTime: ad.updated_time,
    })),
    pagination: {
      total: filteredAds.length,
      limit: params.limit,
    },
  });
}

/**
 * POST /api/ads - Create ad
 */
async function handleCreateAd(
  req: NextApiRequest,
  res: NextApiResponse,
  tenantId: string
) {
  const body = CreateAdSchema.parse(req.body);
  const adAccountId = req.query.adAccountId as string;

  if (!adAccountId) {
    return res.status(400).json({ error: 'adAccountId required' });
  }

  const accessToken = await getAccessToken(tenantId, adAccountId);

  // Step 1: Create ad creative
  const creativeResponse = await fetch(
    `https://graph.facebook.com/v24.0/act_${adAccountId}/adcreatives`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: body.creative.name,
        object_story_spec: {
          page_id: body.creative.objectStorySpec.pageId,
          link_data: body.creative.objectStorySpec.linkData,
        },
      }),
    }
  );

  if (!creativeResponse.ok) {
    const error = await creativeResponse.json();
    return res.status(creativeResponse.status).json({
      error: 'Failed to create ad creative',
      details: error,
    });
  }

  const creative = await creativeResponse.json();

  // Step 2: Create ad with creative
  const adResponse = await fetch(
    `https://graph.facebook.com/v24.0/act_${adAccountId}/ads`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: body.name,
        adset_id: body.adsetId,
        creative: { creative_id: creative.id },
        status: body.status,
      }),
    }
  );

  if (!adResponse.ok) {
    const error = await adResponse.json();
    return res.status(adResponse.status).json({
      error: 'Failed to create ad',
      details: error,
    });
  }

  const ad = await adResponse.json();

  // Save to database
  await AdModel.findOneAndUpdate(
    { adId: ad.id },
    {
      adId: ad.id,
      adSetId: body.adsetId,
      name: body.name,
      status: body.status,
      effectiveStatus: body.status,
    },
    { upsert: true, new: true }
  );

  logger.info('Ad created successfully', { adId: ad.id, tenantId, adAccountId });

  return res.status(201).json({
    success: true,
    data: {
      id: ad.id,
      name: body.name,
      status: body.status,
      adsetId: body.adsetId,
      creativeId: creative.id,
    },
  });
}
