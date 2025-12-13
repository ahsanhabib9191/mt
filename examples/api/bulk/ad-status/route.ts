/**
 * API Route: POST /api/bulk/ad-status
 * Bulk update ad statuses with validation
 * 
 * Example for Next.js App Router
 * Place in: app/api/bulk/ad-status/route.ts
 * 
 * Use Case: Pause multiple ads at once, or reactivate a group of ads
 * Useful for emergency actions or scheduled operations
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { initializeDatabase } from '../../../../lib/db';
import { AdModel } from '../../../../lib/db/models';
import { rateLimitByTenant } from '../../../../lib/middleware/rate-limit';
import logger from '../../../../lib/utils/logger';

/**
 * POST /api/bulk/ad-status
 * Update status for multiple ads at once
 */
const bulkUpdateSchema = z.object({
  adIds: z.array(z.string()).min(1).max(100), // Limit to 100 ads per request
  status: z.enum(['DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED', 'DELETED']),
  reason: z.string().optional(), // Optional reason for audit trail
});

export async function POST(request: NextRequest) {
  try {
    await initializeDatabase();

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

    // Rate limiting (stricter for bulk operations)
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

    // Parse and validate request body
    const body = await request.json();
    const validatedData = bulkUpdateSchema.parse(body);

    // Find all ads owned by this tenant
    const ads = await AdModel.find({
      adId: { $in: validatedData.adIds },
      accountId: { $regex: new RegExp(`^act_.*${user.tenantId}`) },
    });

    if (ads.length === 0) {
      return NextResponse.json(
        { error: 'No ads found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    // Track results
    const results = {
      success: [] as string[],
      failed: [] as { adId: string; reason: string }[],
      skipped: [] as { adId: string; reason: string }[],
    };

    // Process each ad
    for (const ad of ads) {
      try {
        // Business logic: Check if we can change status
        if (validatedData.status === 'ACTIVE') {
          // Validate creative is complete
          if (!ad.creative?.headline || !ad.creative?.body) {
            results.skipped.push({
              adId: ad.adId,
              reason: 'Incomplete creative',
            });
            continue;
          }

          // Check for active issues
          const activeIssues = ad.issues?.filter((i) => i.level === 'ERROR') || [];
          if (activeIssues.length > 0) {
            results.skipped.push({
              adId: ad.adId,
              reason: `${activeIssues.length} active error(s)`,
            });
            continue;
          }
        }

        // Update status
        ad.status = validatedData.status;
        
        // Also update effectiveStatus for certain states
        if (validatedData.status === 'PAUSED') {
          ad.effectiveStatus = 'PAUSED';
        } else if (validatedData.status === 'ACTIVE') {
          ad.effectiveStatus = 'ACTIVE';
        }

        await ad.save();
        results.success.push(ad.adId);
      } catch (error) {
        results.failed.push({
          adId: ad.adId,
          reason: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Check for ads that weren't found
    const foundIds = ads.map((ad) => ad.adId);
    const notFoundIds = validatedData.adIds.filter(
      (id) => !foundIds.includes(id)
    );
    
    if (notFoundIds.length > 0) {
      notFoundIds.forEach((adId) => {
        results.failed.push({
          adId,
          reason: 'Ad not found or not owned by tenant',
        });
      });
    }

    logger.info('Bulk ad status update completed', {
      tenantId: user.tenantId,
      userId: user.userId,
      targetStatus: validatedData.status,
      reason: validatedData.reason,
      successCount: results.success.length,
      failedCount: results.failed.length,
      skippedCount: results.skipped.length,
    });

    return NextResponse.json({
      data: {
        requested: validatedData.adIds.length,
        success: results.success.length,
        failed: results.failed.length,
        skipped: results.skipped.length,
        results,
      },
    });
  } catch (error) {
    logger.error('Error in bulk ad status update', { error });

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
 * Example request:
 * 
 * POST /api/bulk/ad-status
 * Authorization: Bearer <token>
 * Content-Type: application/json
 * 
 * {
 *   "adIds": [
 *     "ad_1234567890_abc123",
 *     "ad_1234567890_def456",
 *     "ad_1234567890_ghi789"
 *   ],
 *   "status": "PAUSED",
 *   "reason": "Budget exhausted for this campaign"
 * }
 * 
 * Example response:
 * 
 * {
 *   "data": {
 *     "requested": 3,
 *     "success": 2,
 *     "failed": 0,
 *     "skipped": 1,
 *     "results": {
 *       "success": [
 *         "ad_1234567890_abc123",
 *         "ad_1234567890_def456"
 *       ],
 *       "failed": [],
 *       "skipped": [
 *         {
 *           "adId": "ad_1234567890_ghi789",
 *           "reason": "Incomplete creative"
 *         }
 *       ]
 *     }
 *   }
 * }
 */
