/**
 * API Route: PATCH /api/ads/:id
 * Update an ad
 * 
 * Example for Next.js App Router
 * Place in: app/api/ads/[id]/route.ts
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { initializeDatabase } from '../../../../lib/db';
import { AdModel } from '../../../../lib/db/models';
import { rateLimitByTenant } from '../../../../lib/middleware/rate-limit';
import logger from '../../../../lib/utils/logger';

/**
 * GET /api/ads/:id
 * Get a single ad by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await initializeDatabase();

    const adId = params.id;

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

    // Find ad and verify ownership through accountId
    const ad = await AdModel.findOne({
      adId,
      accountId: { $regex: new RegExp(`^act_.*${user.tenantId}`) },
    });

    if (!ad) {
      return NextResponse.json(
        { error: 'Ad not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      data: {
        adId: ad.adId,
        adSetId: ad.adSetId,
        campaignId: ad.campaignId,
        accountId: ad.accountId,
        name: ad.name,
        status: ad.status,
        creative: ad.creative,
        effectiveStatus: ad.effectiveStatus,
        issues: ad.issues,
        createdAt: ad.createdAt,
        updatedAt: ad.updatedAt,
      },
    });
  } catch (error) {
    logger.error('Error fetching ad', { error });

    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/ads/:id
 * Update an ad
 */
const updateAdSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  status: z
    .enum(['DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED', 'DELETED'])
    .optional(),
  creative: z
    .object({
      creativeId: z.string().optional(),
      type: z.enum(['IMAGE', 'VIDEO', 'CAROUSEL', 'COLLECTION']).optional(),
      headline: z.string().max(255).optional(),
      body: z.string().max(5000).optional(),
      callToAction: z.string().optional(),
      linkUrl: z.string().url().optional(),
      metadata: z.record(z.any()).optional(),
    })
    .optional(),
  effectiveStatus: z
    .enum([
      'ACTIVE',
      'PAUSED',
      'DELETED',
      'PENDING_REVIEW',
      'DISAPPROVED',
      'PREAPPROVED',
      'PENDING_BILLING_INFO',
      'CAMPAIGN_PAUSED',
      'ARCHIVED',
      'ADSET_PAUSED',
      'IN_PROCESS',
      'WITH_ISSUES',
    ])
    .optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await initializeDatabase();

    const adId = params.id;

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

    // Find ad and verify ownership
    const ad = await AdModel.findOne({
      adId,
      accountId: { $regex: new RegExp(`^act_.*${user.tenantId}`) },
    });

    if (!ad) {
      return NextResponse.json(
        { error: 'Ad not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = updateAdSchema.parse(body);

    // Update fields
    const updateFields: any = {};
    
    if (validatedData.name !== undefined) {
      updateFields.name = validatedData.name;
    }
    
    if (validatedData.status !== undefined) {
      updateFields.status = validatedData.status;
    }
    
    if (validatedData.creative !== undefined) {
      // Merge with existing creative
      updateFields.creative = {
        ...ad.creative,
        ...validatedData.creative,
      };
    }
    
    if (validatedData.effectiveStatus !== undefined) {
      updateFields.effectiveStatus = validatedData.effectiveStatus;
    }

    // Business logic: Check if we can update status
    if (validatedData.status === 'ACTIVE') {
      // Validate creative is complete
      if (!ad.creative?.headline || !ad.creative?.body) {
        return NextResponse.json(
          {
            error: 'Cannot activate ad without complete creative',
            code: 'INVALID_OPERATION',
            details: {
              missing: [
                !ad.creative?.headline && 'headline',
                !ad.creative?.body && 'body',
              ].filter(Boolean),
            },
          },
          { status: 400 }
        );
      }

      // Check if ad has active issues
      if (ad.issues && ad.issues.length > 0) {
        const activeIssues = ad.issues.filter(
          (issue) => issue.level === 'ERROR'
        );
        
        if (activeIssues.length > 0) {
          return NextResponse.json(
            {
              error: 'Cannot activate ad with active issues',
              code: 'INVALID_OPERATION',
              details: {
                issues: activeIssues.map((i) => ({
                  code: i.errorCode,
                  message: i.message,
                })),
              },
            },
            { status: 400 }
          );
        }
      }
    }

    // Apply updates
    Object.assign(ad, updateFields);
    await ad.save();

    logger.info('Ad updated', {
      adId: ad.adId,
      updates: Object.keys(updateFields),
      tenantId: user.tenantId,
      userId: user.userId,
    });

    return NextResponse.json({
      data: {
        adId: ad.adId,
        adSetId: ad.adSetId,
        campaignId: ad.campaignId,
        accountId: ad.accountId,
        name: ad.name,
        status: ad.status,
        creative: ad.creative,
        effectiveStatus: ad.effectiveStatus,
        issues: ad.issues,
        updatedAt: ad.updatedAt,
      },
    });
  } catch (error) {
    logger.error('Error updating ad', { error });

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
 * DELETE /api/ads/:id
 * Soft delete an ad (set status to DELETED)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await initializeDatabase();

    const adId = params.id;

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

    // Find ad and verify ownership
    const ad = await AdModel.findOne({
      adId,
      accountId: { $regex: new RegExp(`^act_.*${user.tenantId}`) },
    });

    if (!ad) {
      return NextResponse.json(
        { error: 'Ad not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    // Soft delete
    ad.status = 'DELETED';
    ad.effectiveStatus = 'DELETED';
    await ad.save();

    logger.info('Ad deleted', {
      adId: ad.adId,
      tenantId: user.tenantId,
      userId: user.userId,
    });

    return NextResponse.json({
      data: {
        adId: ad.adId,
        status: ad.status,
        deletedAt: ad.updatedAt,
      },
    });
  } catch (error) {
    logger.error('Error deleting ad', { error });

    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
