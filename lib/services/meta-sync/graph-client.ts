import { MetaConnection, IMetaConnection } from '../../db/models/MetaConnection';
import logger from '../../utils/logger';
import { redis } from '../../db/redis';

const GRAPH_VERSION = process.env.META_API_VERSION || process.env.META_GRAPH_VERSION || 'v21.0';
const META_APP_ID = process.env.META_APP_ID;
const META_APP_SECRET = process.env.META_APP_SECRET;
const GRAPH_BASE_URL = `https://graph.facebook.com/${GRAPH_VERSION}`;

if (!META_APP_ID || !META_APP_SECRET) {
  logger.warn(
    'META_APP_ID or META_APP_SECRET is not configured. Meta Graph sync will fail until both are provided.'
  );
}

const TOKEN_REFRESH_THRESHOLD_MS = 5 * 60 * 1000; // refresh 5 minutes before expiry
const MAX_RETRIES = 3;
const RATE_LIMIT_MAX = 180; // Conservative limit (out of 200/hour)
const RATE_LIMIT_WINDOW = 3600; // 1 hour in seconds

interface GraphError {
  code: number;
  message: string;
  error_subcode?: number;
  fbtrace_id?: string;
}

interface GraphResponse<T> {
  data: T[];
  paging?: { next?: string; cursors?: { after?: string; before?: string } };
  error?: GraphError;
}

export class MetaAPIError extends Error {
  constructor(
    message: string,
    public code: number,
    public subcode?: number,
    public fbtrace_id?: string
  ) {
    super(message);
    this.name = 'MetaAPIError';
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function checkRateLimit(userId: string): Promise<void> {
  try {
    const rateLimitKey = `meta:ratelimit:${userId}`;
    const count = await redis.incr(rateLimitKey);

    if (count === 1) {
      await redis.expire(rateLimitKey, RATE_LIMIT_WINDOW);
    }

    if (count > RATE_LIMIT_MAX) {
      const ttl = await redis.ttl(rateLimitKey);
      logger.warn('Meta API rate limit reached', { userId, count, ttl });
      throw new MetaAPIError('Rate limit exceeded', 17);
    }

    if (count > RATE_LIMIT_MAX * 0.9) {
      logger.warn('Approaching Meta API rate limit', { userId, count });
    }
  } catch (error) {
    if (error instanceof MetaAPIError) throw error;
    logger.error('Rate limit check failed', { error });
  }
}

function buildUrl(path: string, params?: Record<string, string>): URL {
  const url = new URL(`${GRAPH_BASE_URL}/${path}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
  }
  return url;
}

async function fetchJson<T>(
  url: string,
  accessToken: string,
  userId?: string,
  retryCount = 0
): Promise<T> {
  if (userId) {
    await checkRateLimit(userId);
  }

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const payload = (await response.json()) as T & { error?: GraphError };

    if (!response.ok || (payload && (payload as any).error)) {
      const error = (payload as any).error;

      if (error) {
        const apiError = new MetaAPIError(
          error.message,
          error.code,
          error.error_subcode,
          error.fbtrace_id
        );

        // Handle specific error codes
        if (error.code === 190) {
          // Token expired - caller should refresh
          logger.error('Meta API token expired', { code: error.code, fbtrace_id: error.fbtrace_id });
          throw apiError;
        }

        if (error.code === 17 || error.code === 4 || error.code === 2) {
          // Rate limit or temporary error - retry with exponential backoff
          if (retryCount < MAX_RETRIES) {
            const backoff = Math.pow(2, retryCount) * 1000;
            logger.warn('Meta API temporary error, retrying', {
              code: error.code,
              retryCount,
              backoffMs: backoff
            });
            await sleep(backoff);
            return fetchJson<T>(url, accessToken, userId, retryCount + 1);
          }
        }

        if (error.code === 100) {
          // Invalid parameter - don't retry
          logger.error('Meta API invalid parameter', {
            code: error.code,
            message: error.message,
            url
          });
        }

        throw apiError;
      }

      const message = `Meta Graph returned HTTP ${response.status}`;
      throw new MetaAPIError(message, response.status);
    }

    return payload;
  } catch (error) {
    if (error instanceof MetaAPIError) throw error;

    // Network or other errors - retry
    if (retryCount < MAX_RETRIES) {
      const backoff = Math.pow(2, retryCount) * 1000;
      logger.warn('Meta API request failed, retrying', {
        error: error instanceof Error ? error.message : 'Unknown error',
        retryCount,
        backoffMs: backoff
      });
      await sleep(backoff);
      return fetchJson<T>(url, accessToken, userId, retryCount + 1);
    }

    throw error;
  }
}

async function refreshAccessToken(connection: IMetaConnection): Promise<IMetaConnection> {
  if (!META_APP_ID || !META_APP_SECRET) {
    throw new Error('META_APP_ID and META_APP_SECRET must be defined to refresh tokens.');
  }

  const refreshToken = connection.getRefreshToken();

  if (!refreshToken) {
    throw new Error('Cannot refresh Meta token because refreshToken is missing.');
  }

  const refreshUrl = new URL('https://graph.facebook.com/oauth/access_token');
  refreshUrl.searchParams.set('grant_type', 'fb_exchange_token');
  refreshUrl.searchParams.set('client_id', META_APP_ID!);
  refreshUrl.searchParams.set('client_secret', META_APP_SECRET!);
  refreshUrl.searchParams.set('fb_exchange_token', refreshToken);

  const refreshResponse = await fetch(refreshUrl.toString());
  const refreshPayload = (await refreshResponse.json()) as Record<string, any> & { error?: GraphError };

  if (!refreshResponse.ok || refreshPayload?.error) {
    const error = refreshPayload?.error;
    const message = error ? `${error.code} ${error.message}` : 'Failed to refresh Meta token';
    throw new Error(message);
  }

  const data = refreshPayload;

  const expiresIn = typeof data.expires_in === 'number' ? data.expires_in : undefined;
  const updated = await MetaConnection.updateTokens(connection.tenantId, connection.adAccountId, {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken,
    tokenExpiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000) : undefined,
    status: 'ACTIVE',
  });

  if (!updated) {
    throw new Error('Failed to update MetaConnection after refreshing tokens.');
  }

  return updated;
}

export async function ensureConnectionAccessToken(
  connection: IMetaConnection
): Promise<{ connection: IMetaConnection; accessToken: string }> {
  const currentToken = connection.getAccessToken();

  // MOCK MODE: Skip refresh logic for mock tokens
  if (currentToken?.includes('mock_') || currentToken === 'mock_access_token_123') {
    return { connection, accessToken: currentToken };
  }

  const needsRefresh =
    connection.tokenExpiresAt && connection.tokenExpiresAt.getTime() - Date.now() < TOKEN_REFRESH_THRESHOLD_MS;

  if (needsRefresh) {
    const refreshed = await refreshAccessToken(connection);
    return { connection: refreshed, accessToken: refreshed.getAccessToken() };
  }

  return { connection, accessToken: connection.getAccessToken() };
}

export async function fetchGraphEdges<T>(
  accessToken: string,
  path: string,
  params?: Record<string, string>,
  userId?: string
): Promise<T[]> {
  const results: T[] = [];
  let nextUrl = buildUrl(path, params).toString();

  while (nextUrl) {
    const payload = await fetchJson<GraphResponse<T>>(nextUrl, accessToken, userId);
    if (payload?.data) {
      results.push(...payload.data);
    }

    nextUrl = payload?.paging?.next || '';
  }

  return results;
}

export async function fetchGraphNode<T>(
  accessToken: string,
  path: string,
  params?: Record<string, string>,
  userId?: string
): Promise<T> {
  const url = buildUrl(path, params).toString();
  return fetchJson<T>(url, accessToken, userId);
}

export async function fetchInsights<T>(
  accessToken: string,
  objectId: string,
  params: Record<string, string>,
  userId?: string
): Promise<T[]> {

  // MOCK MODE INTERCEPTION
  if (accessToken.includes('mock_')) {
    logger.info('MOCK MODE: Fetching Insights from Local DB', { objectId, level: params.level });

    // Dynamic import to avoid cycles or load issues
    const { PerformanceSnapshotModel } = await import('../../db/models/performance-snapshot');
    const { AdModel } = await import('../../db/models/ad');
    const { AdSetModel } = await import('../../db/models/ad-set');

    const level = params.level; // 'ad' or 'adset'
    const entityType = level === 'ad' ? 'AD' : 'AD_SET';

    // Calculate date range (last 7 days)
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);

    // Aggregate Snapshots
    const rawStats = await PerformanceSnapshotModel.aggregate([
      {
        $match: {
          accountId: objectId,
          entityType: entityType,
          date: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$entityId',
          spend: { $sum: '$spend' },
          clicks: { $sum: '$clicks' },
          impressions: { $sum: '$impressions' },
          conversions: { $sum: '$conversions' },
          revenue: { $sum: '$revenue' }
        }
      }
    ]);

    // Format like Graph API response
    const results = await Promise.all(rawStats.map(async (stat) => {
      let name = 'Unknown';
      // Fetch name
      if (entityType === 'AD') {
        const ent = await AdModel.findOne({ adId: stat._id });
        name = ent?.name || 'Mock Ad';
      } else {
        const ent = await AdSetModel.findOne({ adSetId: stat._id });
        name = ent?.name || 'Mock Ad Set';
      }

      return {
        [level === 'ad' ? 'ad_id' : 'adset_id']: stat._id,
        [level === 'ad' ? 'ad_name' : 'adset_name']: name,
        spend: stat.spend.toString(),
        impressions: stat.impressions.toString(),
        clicks: stat.clicks.toString(),
        cpc: (stat.spend / stat.clicks).toFixed(2),
        ctr: (stat.clicks / stat.impressions * 100).toFixed(2),
        actions: [
          { action_type: 'purchase', value: stat.conversions },
          { action_type: 'offsite_conversion.fb_pixel_purchase', value: stat.conversions }
        ],
        action_values: [
          { action_type: 'purchase', value: stat.revenue },
          { action_type: 'offsite_conversion.fb_pixel_purchase', value: stat.revenue }
        ]
      } as unknown as T;
    }));

    return results;
  }

  const results: T[] = [];
  const url = buildUrl(`${objectId}/insights`, params);
  let nextUrl = url.toString();

  while (nextUrl) {
    const payload = await fetchJson<GraphResponse<T>>(nextUrl, accessToken, userId);
    if (payload?.data) {
      results.push(...payload.data);
    }

    nextUrl = payload?.paging?.next || '';
  }

  return results;
}

export async function batchRequest(
  accessToken: string,
  requests: Array<{ method: string; relative_url: string }>,
  userId?: string
): Promise<any[]> {
  const url = buildUrl('', { access_token: accessToken });

  if (userId) {
    await checkRateLimit(userId);
  }

  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ batch: requests }),
  });

  if (!response.ok) {
    throw new MetaAPIError(`Batch request failed with status ${response.status}`, response.status);
  }

  const results = (await response.json()) as any[];
  return results;
}

export function buildGraphEdgeParams(fields: string[], limit = 100): Record<string, string> {
  return {
    fields: fields.join(','),
    limit: limit.toString(),
  };
}

export async function postGraphEdge<T>(
  accessToken: string,
  objectId: string,
  edge: string,
  data: Record<string, any>,
  userId?: string
): Promise<T> {
  const url = buildUrl(`${objectId}/${edge}`).toString();

  if (userId) {
    await checkRateLimit(userId);
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  const payload = (await response.json()) as T & { error?: GraphError };

  if (!response.ok || (payload && (payload as any).error)) {
    const error = (payload as any).error;
    if (error) {
      // Log full error details for debugging
      logger.error('Meta API Error', {
        code: error.code,
        subcode: error.error_subcode,
        message: error.message,
        userTitle: error.error_user_title,
        userMsg: error.error_user_msg,
        fbtrace_id: error.fbtrace_id,
        requestData: data,
      });

      throw new MetaAPIError(
        error.message,
        error.code,
        error.error_subcode,
        error.fbtrace_id
      );
    }
    throw new MetaAPIError(`Meta Graph POST returned HTTP ${response.status}`, response.status);
  }

  return payload;
}

export async function deleteGraphNode(
  accessToken: string,
  objectId: string,
  userId?: string
): Promise<boolean> {
  const url = buildUrl(objectId).toString();

  if (userId) {
    await checkRateLimit(userId);
  }

  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const payload = (await response.json()) as { success?: boolean; error?: GraphError };

  if (!response.ok || (payload && payload.error)) {
    const error = payload.error;
    if (error) {
      throw new MetaAPIError(
        error.message,
        error.code,
        error.error_subcode,
        error.fbtrace_id
      );
    }
    throw new MetaAPIError(`Meta Graph DELETE returned HTTP ${response.status}`, response.status);
  }

  return payload.success === true;
}
