/**
 * API Route: POST /api/campaigns/:id/ad-sets
 * Create a new ad set for a campaign
 * 
 * Example for Next.js App Router
 * Place in: app/api/campaigns/[id]/ad-sets/route.ts
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { initializeDatabase } from '../../../../../lib/db';
import { AdSetModel } from '../../../../../lib/db/models';
import { CampaignModel } from '../../../../../lib/db/models';
import { requireAuth } from '../../../../../lib/middleware/auth';
import { rateLimitByTenant } from '../../../../../lib/middleware/rate-limit';
import { AppError } from '../../../../../lib/middleware/error-handler';
import logger from '../../../../../lib/utils/logger';

// Validation schema for creating an ad set
const createAdSetSchema = z.object({
  name: z.string().min(1).max(255),
  budget: z.number().min(0),
  optimizationGoal: z.string().min(1),
  targeting: z.object({
    audienceSize: z.number().min(0).optional(),
    ageMin: z.number().min(13).max(65).optional(),
    ageMax: z.number().min(13).max(65).optional(),
    genders: z.array(z.number()).optional(),
    locations: z.array(z.string()).optional(),
    interests: z.array(z.string()).optional(),
    customAudiences: z.array(z.string()).optional(),
    lookalikes: z.array(z.string()).optional(),
    exclusions: z.record(z.any()).optional(),
  }).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

/**
 * POST /api/campaigns/:id/ad-sets
 * Create a new ad set
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Initialize database
    await initializeDatabase();

    // Get campaign ID from URL
    const campaignId = params.id;

    // Authentication - extract user from request
    // In a real Next.js app, you'd use NextAuth or similar
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    // For this example, we'll simulate auth verification
    // In production, use your auth middleware
    const user = {
      userId: 'user-123',
      tenantId: 'tenant-123',
      email: 'user@example.com',
      plan: 'PRO' as const,
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

    // Verify campaign exists and belongs to user's tenant
    const campaign = await CampaignModel.findOne({
      campaignId,
      accountId: { $regex: new RegExp(`^act_.*${user.tenantId}`) },
    });

    if (!campaign) {
      return NextResponse.json(
        { error: 'Campaign not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = createAdSetSchema.parse(body);

    // Generate unique ad set ID
    const adSetId = `adset_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    // Create ad set
    const adSet = await AdSetModel.create({
      adSetId,
      campaignId: campaign.campaignId,
      accountId: campaign.accountId,
      name: validatedData.name,
      status: 'DRAFT', // Start as draft
      budget: validatedData.budget,
      targeting: validatedData.targeting || {},
      learningPhaseStatus: 'NOT_STARTED',
      optimizationGoal: validatedData.optimizationGoal,
      deliveryStatus: 'INACTIVE',
      optimizationEventsCount: 0,
      ageDays: 0,
      startDate: validatedData.startDate ? new Date(validatedData.startDate) : undefined,
      endDate: validatedData.endDate ? new Date(validatedData.endDate) : undefined,
    });

    // Log creation
    logger.info('Ad set created', {
      adSetId: adSet.adSetId,
      campaignId: campaign.campaignId,
      tenantId: user.tenantId,
      userId: user.userId,
    });

    // Return created ad set
    return NextResponse.json(
      {
        data: {
          adSetId: adSet.adSetId,
          campaignId: adSet.campaignId,
          name: adSet.name,
          status: adSet.status,
          budget: adSet.budget,
          targeting: adSet.targeting,
          learningPhaseStatus: adSet.learningPhaseStatus,
          optimizationGoal: adSet.optimizationGoal,
          createdAt: adSet.createdAt,
          updatedAt: adSet.updatedAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error('Error creating ad set', { error });

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

    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/campaigns/:id/ad-sets
 * List all ad sets for a campaign
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await initializeDatabase();

    const campaignId = params.id;
    const { searchParams } = new URL(request.url);
    
    // Query parameters
    const status = searchParams.get('status');
    const learningPhaseStatus = searchParams.get('learningPhaseStatus');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') === 'asc' ? 1 : -1;

    // Authentication (simplified for example)
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

    // Verify campaign exists
    const campaign = await CampaignModel.findOne({
      campaignId,
      accountId: { $regex: new RegExp(`^act_.*${user.tenantId}`) },
    });

    if (!campaign) {
      return NextResponse.json(
        { error: 'Campaign not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    // Build query
    const query: any = { campaignId: campaign.campaignId };
    
    if (status) {
      query.status = status;
    }
    
    if (learningPhaseStatus) {
      query.learningPhaseStatus = learningPhaseStatus;
    }

    // Execute query with pagination
    const skip = (page - 1) * limit;
    const [adSets, total] = await Promise.all([
      AdSetModel.find(query)
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(limit)
        .lean(),
      AdSetModel.countDocuments(query),
    ]);

    // Calculate pagination metadata
    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    return NextResponse.json({
      data: adSets,
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
    logger.error('Error fetching ad sets', { error });

    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
