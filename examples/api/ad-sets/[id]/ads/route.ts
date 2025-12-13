/**
 * API Route: GET /api/ad-sets/:id/ads
 * List all ads in an ad set
 * 
 * Example for Next.js App Router
 * Place in: app/api/ad-sets/[id]/ads/route.ts
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { initializeDatabase } from '../../../../lib/db';
import { AdModel, AdSetModel } from '../../../../lib/db/models';
import { rateLimitByTenant } from '../../../../lib/middleware/rate-limit';
import logger from '../../../../lib/utils/logger';

/**
 * POST /api/ad-sets/:id/ads
 * Create a new ad in an ad set
 */
const createAdSchema = z.object({
  name: z.string().min(1).max(255),
  creative: z.object({
    creativeId: z.string().optional(),
    type: z.enum(['IMAGE', 'VIDEO', 'CAROUSEL', 'COLLECTION']).optional(),
    headline: z.string().max(255).optional(),
    body: z.string().max(5000).optional(),
    callToAction: z.string().optional(),
    linkUrl: z.string().url().optional(),
    metadata: z.record(z.any()).optional(),
  }),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await initializeDatabase();

    const adSetId = params.id;

    // Authentication (simplified)
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const user = {
      userId: 'user-123',
      tenantId: 'tenant-123',
    };

    // Rate limiting
    const rateLimitResult = await rateLimitByTenant(
      request as any,
      user.tenantId
    );
    
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: rateLimitResult.retryAfter,
        },
        {
          status: 429,
          headers: {
            'Retry-After': rateLimitResult.retryAfter?.toString() || '60',
          },
        }
      );
    }

    // Verify ad set exists
    const adSet = await AdSetModel.findOne({
      adSetId,
      accountId: { $regex: new RegExp(`^act_.*${user.tenantId}`) },
    });

    if (!adSet) {
      return NextResponse.json(
        { error: 'Ad set not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = createAdSchema.parse(body);

    // Generate unique ad ID
    const adId = `ad_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    // Create ad
    const ad = await AdModel.create({
      adId,
      adSetId: adSet.adSetId,
      campaignId: adSet.campaignId,
      accountId: adSet.accountId,
      name: validatedData.name,
      status: 'DRAFT', // Start as draft
      creative: validatedData.creative,
      effectiveStatus: 'PAUSED', // Default to paused until activated
      issues: [],
    });

    logger.info('Ad created', {
      adId: ad.adId,
      adSetId: adSet.adSetId,
      campaignId: adSet.campaignId,
      tenantId: user.tenantId,
      userId: user.userId,
    });

    return NextResponse.json(
      {
        data: {
          adId: ad.adId,
          adSetId: ad.adSetId,
          campaignId: ad.campaignId,
          name: ad.name,
          status: ad.status,
          creative: ad.creative,
          effectiveStatus: ad.effectiveStatus,
          issues: ad.issues,
          createdAt: ad.createdAt,
          updatedAt: ad.updatedAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error('Error creating ad', { error });

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Validation error',
          code: 'VALIDATION_ERROR',
          details: error.errors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/ad-sets/:id/ads
 * List all ads in an ad set
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await initializeDatabase();

    const adSetId = params.id;
    const { searchParams } = new URL(request.url);
    
    // Query parameters
    const status = searchParams.get('status');
    const effectiveStatus = searchParams.get('effectiveStatus');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') === 'asc' ? 1 : -1;

    // Authentication (simplified)
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const user = {
      tenantId: 'tenant-123',
    };

    // Verify ad set exists
    const adSet = await AdSetModel.findOne({
      adSetId,
      accountId: { $regex: new RegExp(`^act_.*${user.tenantId}`) },
    });

    if (!adSet) {
      return NextResponse.json(
        { error: 'Ad set not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    // Build query
    const query: any = { adSetId: adSet.adSetId };
    
    if (status) {
      query.status = status;
    }
    
    if (effectiveStatus) {
      query.effectiveStatus = effectiveStatus;
    }

    // Execute query with pagination
    const skip = (page - 1) * limit;
    const [ads, total] = await Promise.all([
      AdModel.find(query)
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(limit)
        .lean(),
      AdModel.countDocuments(query),
    ]);

    // Calculate pagination metadata
    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    return NextResponse.json({
      data: ads,
      meta: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage,
        hasPrevPage,
      },
    });
  } catch (error) {
    logger.error('Error fetching ads', { error });

    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
