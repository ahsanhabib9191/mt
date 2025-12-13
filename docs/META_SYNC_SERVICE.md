# Meta Sync Service - Complete Implementation Guide

## Overview

The Meta Sync Service provides complete bidirectional synchronization between your database and the Meta (Facebook) Ads API. It handles campaigns, ad sets, ads, and performance data with robust error handling, rate limiting, and webhook support.

## ✅ Completed Features

### 1. Core Sync Functionality

#### Campaign Sync (`syncMetaConnection`)
- ✅ Fetches all campaigns from Meta API
- ✅ Upserts campaigns to MongoDB
- ✅ Maps Meta statuses to internal statuses
- ✅ Handles budget and date fields
- ✅ Supports pagination for large datasets

#### AdSet Sync
- ✅ Fetches ad sets with targeting data
- ✅ Tracks learning phase status
- ✅ Maps targeting parameters (locations, interests, demographics)
- ✅ Links ad sets to campaigns
- ✅ Handles delivery status

#### Ad Sync
- ✅ Fetches ads with creative data
- ✅ Tracks effective status (active, paused, disapproved, etc.)
- ✅ Maps creative fields (headline, body, CTA, media)
- ✅ Handles issues and policy violations
- ✅ Links ads to ad sets and campaigns

### 2. Performance Data Collection

#### Insights Sync (`syncAllPerformanceData`)
- ✅ Fetches insights from Meta Insights API
- ✅ Supports configurable date presets (yesterday, last_7d, last_30d)
- ✅ Daily granularity for time-series analysis
- ✅ Extracts key metrics:
  - Impressions
  - Clicks
  - Spend
  - Conversions (purchases, leads)
  - Revenue (from action values)
- ✅ Stores in PerformanceSnapshot model
- ✅ Prevents duplicates with unique indexes

### 3. Webhook Handlers

#### Real-time Updates (`lib/webhooks/meta.ts`)
- ✅ Webhook signature verification (SHA1 HMAC)
- ✅ Subscription verification (hub.challenge)
- ✅ Handles campaign updates
- ✅ Handles ad set updates
- ✅ Handles ad updates
- ✅ Parallel processing with error isolation
- ✅ Automatic entity sync on webhook events

### 4. Error Handling & Retries

#### Meta API Error Handling
- ✅ Token expiration detection (error code 190)
- ✅ Rate limit detection (error code 17)
- ✅ Throttling with exponential backoff
- ✅ Invalid parameter detection (error code 100)
- ✅ Temporary service errors (error code 2, 4)
- ✅ Automatic token refresh before expiry
- ✅ Max 3 retries with exponential backoff

#### Rate Limiting
- ✅ Redis-backed rate limiting
- ✅ 180 calls per hour limit (conservative, out of 200)
- ✅ Per-user tracking
- ✅ Automatic throttling when approaching limit
- ✅ Warning logs at 90% capacity

### 5. Background Jobs

#### Sync Scripts
- ✅ `sync-meta.ts` - Full campaign/ad set/ad sync
- ✅ `sync-performance.ts` - Performance data sync
- ✅ Distributed locking with Redis (prevents duplicate jobs)
- ✅ Periodic execution support (--loop flag)
- ✅ Configurable intervals
- ✅ Graceful error handling

## Architecture

### Data Flow

```
┌─────────────────┐
│   Meta Ads API  │
│  (Graph API)    │
└────────┬────────┘
         │
         │ HTTP Requests
         │ (with retry & rate limiting)
         ↓
┌─────────────────────────────────┐
│   Graph Client                  │
│   - fetchGraphEdges()           │
│   - fetchGraphNode()            │
│   - fetchInsights()             │
│   - ensureConnectionAccessToken()│
└─────────────┬───────────────────┘
              │
              │ Type-safe responses
              ↓
┌─────────────────────────────────┐
│   Sync Service                  │
│   - upsertCampaignFromGraph()  │
│   - upsertAdSetFromGraph()     │
│   - upsertAdFromGraph()        │
│   - upsertPerformanceSnapshot()│
└─────────────┬───────────────────┘
              │
              │ Upsert operations
              ↓
┌─────────────────────────────────┐
│   MongoDB (Mongoose)            │
│   - Campaign model              │
│   - AdSet model                 │
│   - Ad model                    │
│   - PerformanceSnapshot model   │
└─────────────────────────────────┘
```

### Webhook Flow

```
┌─────────────┐
│  Meta       │
│  Webhook    │
└──────┬──────┘
       │ POST /webhooks/meta
       │ (with signature)
       ↓
┌──────────────────────────────────┐
│  Webhook Handler                 │
│  1. Verify signature             │
│  2. Parse payload                │
│  3. Extract entity IDs           │
└──────────┬───────────────────────┘
           │
           │ Fetch latest data
           ↓
┌──────────────────────────────────┐
│  Sync Service                    │
│  - syncCampaignFromWebhook()    │
│  - syncAdSetFromWebhook()       │
│  - syncAdFromWebhook()          │
└──────────┬───────────────────────┘
           │
           ↓
      [Database]
```

## Usage

### 1. Environment Configuration

Required environment variables in `.env`:

```bash
# Meta App Credentials
META_APP_ID=your_app_id
META_APP_SECRET=your_app_secret
META_APP_VERIFY_TOKEN=your_webhook_verify_token
META_API_VERSION=v21.0

# Sync Configuration
META_SYNC_INTERVAL_MINUTES=60
PERFORMANCE_SYNC_INTERVAL_MINUTES=60

# Database
MONGODB_URI=mongodb://localhost:27017/meta-ads
REDIS_URL=redis://localhost:6379
```

### 2. Test Meta API Connection

```bash
npm run test:meta
```

This validates:
- App credentials are correct
- API access is working
- App is active and configured

### 3. Run Comprehensive Sync Tests

```bash
npm run test:meta-sync
```

Tests all components:
- Environment configuration
- Database connections
- Model schemas
- Webhook handlers
- Rate limiting
- Actual sync (if connection exists)

### 4. Manual Sync

#### One-time Full Sync
```bash
npm run sync:meta
```

#### One-time Sync with Performance Data
```bash
npm run sync:meta -- --performance
```

#### Periodic Sync (runs continuously)
```bash
npm run sync:meta:loop
```

### 5. Performance Data Sync

#### Sync Yesterday's Data
```bash
npm run sync:performance
```

#### Sync Last 7 Days
```bash
npm run sync:performance -- --preset=last_7d
```

#### Periodic Performance Sync
```bash
npm run sync:performance:loop
```

### 6. Custom Intervals

```bash
# Sync every 30 minutes
npm run sync:meta:loop -- --interval=30

# Sync performance every 2 hours
npm run sync:performance:loop -- --interval=120
```

## API Reference

### Sync Service Functions

#### `syncMetaConnection(connection, syncPerformance?)`

Syncs all campaigns, ad sets, and ads for a Meta connection.

**Parameters:**
- `connection`: IMetaConnection - The Meta connection to sync
- `syncPerformance?`: boolean - Whether to also sync performance data (default: false)

**Returns:**
```typescript
{
  campaignsSynced: number;
  adSetsSynced: number;
  adsSynced: number;
  durationMs: number;
  performanceStats?: {
    campaigns: number;
    adSets: number;
    ads: number;
  };
}
```

**Example:**
```typescript
import { syncMetaConnection } from './lib/services/meta-sync/sync-service';
import { MetaConnectionModel } from './lib/db/models/MetaConnection';

const connection = await MetaConnectionModel.findOne({ 
  tenantId: 'tenant_123' 
}).exec();

const result = await syncMetaConnection(connection, true);
console.log(`Synced ${result.campaignsSynced} campaigns`);
```

#### `syncAllPerformanceData(connection, datePreset?)`

Syncs performance data for all campaigns, ad sets, and ads.

**Parameters:**
- `connection`: IMetaConnection - The Meta connection
- `datePreset?`: string - Meta date preset (default: 'last_7d')
  - Options: 'today', 'yesterday', 'last_7d', 'last_30d', 'this_month', 'last_month'

**Returns:**
```typescript
{
  campaigns: number;  // Number of snapshots created
  adSets: number;
  ads: number;
}
```

#### `syncCampaignFromWebhook(connection, campaignId)`

Syncs a single campaign (called from webhook handler).

**Parameters:**
- `connection`: IMetaConnection
- `campaignId`: string - Meta campaign ID

**Returns:** Promise<ICampaign>

#### `syncAdSetFromWebhook(connection, adSetId)`

Syncs a single ad set (called from webhook handler).

**Parameters:**
- `connection`: IMetaConnection
- `adSetId`: string - Meta ad set ID

**Returns:** Promise<IAdSet>

#### `syncAdFromWebhook(connection, adId)`

Syncs a single ad (called from webhook handler).

**Parameters:**
- `connection`: IMetaConnection
- `adId`: string - Meta ad ID

**Returns:** Promise<IAd>

### Graph Client Functions

#### `ensureConnectionAccessToken(connection)`

Ensures access token is valid and refreshes if needed.

**Parameters:**
- `connection`: IMetaConnection

**Returns:**
```typescript
{
  connection: IMetaConnection;  // Updated connection
  accessToken: string;          // Valid access token
}
```

#### `fetchGraphEdges<T>(accessToken, path, params?, userId?)`

Fetches paginated data from Meta Graph API.

**Parameters:**
- `accessToken`: string
- `path`: string - API endpoint (e.g., 'act_123/campaigns')
- `params?`: Record<string, string> - Query parameters
- `userId?`: string - For rate limiting

**Returns:** Promise<T[]> - All pages combined

#### `fetchGraphNode<T>(accessToken, path, params?, userId?)`

Fetches a single node from Meta Graph API.

**Parameters:**
- `accessToken`: string
- `path`: string - API endpoint (e.g., '123456789')
- `params?`: Record<string, string> - Query parameters
- `userId?`: string - For rate limiting

**Returns:** Promise<T> - Single node

#### `fetchInsights<T>(accessToken, objectId, params, userId?)`

Fetches insights (performance data) from Meta API.

**Parameters:**
- `accessToken`: string
- `objectId`: string - Campaign/AdSet/Ad ID
- `params`: Record<string, string> - Must include 'fields' and 'date_preset'
- `userId?`: string - For rate limiting

**Returns:** Promise<T[]> - Insights data

### Webhook Functions

#### `handleMetaWebhook(body)`

Processes Meta webhook payload.

**Parameters:**
- `body`: MetaWebhookPayload

**Example:**
```typescript
import { handleMetaWebhook } from './lib/webhooks/meta';

// In your Next.js API route
export async function POST(req: Request) {
  const body = await req.json();
  await handleMetaWebhook(body);
  return new Response('OK', { status: 200 });
}
```

#### `verifyMetaWebhookSignature(signature, rawBody)`

Verifies webhook signature for security.

**Parameters:**
- `signature`: string - x-hub-signature header value
- `rawBody`: string - Raw request body (before parsing)

**Returns:** boolean

**Example:**
```typescript
import { verifyMetaWebhookSignature } from './lib/webhooks/meta';

const signature = req.headers.get('x-hub-signature');
const rawBody = await req.text();

if (!verifyMetaWebhookSignature(signature, rawBody)) {
  return new Response('Invalid signature', { status: 401 });
}
```

#### `resolveMetaWebhookChallenge(query)`

Handles webhook subscription verification.

**Parameters:**
- `query`: Record<string, string> - Query parameters

**Returns:** string | null - Challenge value if valid

**Example:**
```typescript
// In your webhook GET handler
export async function GET(req: Request) {
  const url = new URL(req.url);
  const query = Object.fromEntries(url.searchParams);
  
  const challenge = resolveMetaWebhookChallenge(query);
  if (challenge) {
    return new Response(challenge, { status: 200 });
  }
  
  return new Response('Invalid verification', { status: 403 });
}
```

## Error Handling

### Common Errors

#### 1. Token Expired (Error 190)

```
Meta API token expired
```

**Solution:**
- The service automatically refreshes tokens 5 minutes before expiry
- If refresh fails, user needs to re-authenticate via OAuth
- Connection status set to 'EXPIRED'

#### 2. Rate Limit (Error 17)

```
Meta API rate limit reached
```

**Solution:**
- Automatic exponential backoff (1s, 2s, 4s)
- Max 3 retries
- Redis tracks API call count per user
- Warning logged at 90% capacity (180/200 calls)

#### 3. Invalid Parameter (Error 100)

```
Meta API invalid parameter
```

**Solution:**
- Don't retry (validation error)
- Check field names and values
- Consult Meta API docs for correct parameters

### Error Recovery

The sync service implements comprehensive error recovery:

1. **Network Errors**: Retry with exponential backoff
2. **API Errors**: Handle based on error code
3. **Database Errors**: Logged but don't stop sync
4. **Partial Failures**: Continue processing remaining entities
5. **Webhook Errors**: Isolated per change (one failure doesn't block others)

## Performance Optimization

### 1. Parallel Processing

All sync operations run in parallel where possible:
- Campaigns, ad sets, and ads fetched simultaneously
- Upsert operations batched with Promise.all
- Performance snapshots synced in parallel

### 2. Pagination

Large datasets are paginated:
- 100 items per page (configurable)
- Cursor-based pagination
- Automatic next page fetching

### 3. Caching

Rate limit counters cached in Redis:
- 1 hour TTL
- Per-user tracking
- Prevents API overuse

### 4. Selective Sync

Sync only what's needed:
- Filter by status (exclude ARCHIVED)
- Configurable date ranges for performance data
- Webhook-triggered sync for real-time updates

## Monitoring & Logging

### Log Levels

**Info:**
- Sync started/completed
- Entity counts
- Duration metrics

**Warn:**
- Approaching rate limit
- Unknown ad account in webhook
- No insights data available

**Error:**
- Sync failures
- API errors
- Token refresh failures
- Webhook processing errors

### Metrics to Monitor

1. **Sync Duration**: Should be < 30s for most accounts
2. **API Call Count**: Should stay under 180/hour per user
3. **Error Rate**: Should be < 5%
4. **Webhook Processing Time**: Should be < 5s

### Example Log Output

```
info: Starting Meta sync job {
  syncPerformance: false,
  runLoop: true,
  intervalMinutes: 60
}
info: Meta connection synced {
  tenantId: 'tenant_123',
  adAccountId: 'act_456',
  campaignCount: 5,
  adSetCount: 12,
  adCount: 48,
  durationMs: 8432
}
info: Performance data synced {
  entityType: 'CAMPAIGN',
  entityId: '123456',
  snapshotCount: 7
}
```

## Testing with Meta Test Accounts

### 1. Create Test Ad Account

1. Go to [Meta Business Manager](https://business.facebook.com)
2. Navigate to Ad Accounts
3. Create Test Ad Account
4. Note the ad account ID (act_XXXXX)

### 2. Set Up Test Campaigns

```bash
# Use Meta Ads Manager to create:
- 1-2 test campaigns
- 2-3 ad sets per campaign
- 3-5 ads per ad set
```

### 3. Run Test Sync

```bash
# Test connection
npm run test:meta

# Test full sync
npm run test:meta-sync

# Run actual sync
npm run sync:meta
```

## Deployment

### Production Considerations

1. **Environment Variables**: Store securely (AWS Secrets Manager, Vercel Env Vars)
2. **Background Jobs**: Run with PM2 or as Docker containers
3. **Monitoring**: Set up Sentry or DataDog for error tracking
4. **Rate Limiting**: Consider multiple accounts carefully
5. **Database**: Use MongoDB Atlas with proper indexes
6. **Redis**: Use managed Redis (AWS ElastiCache, Redis Cloud)

### Docker Deployment

```bash
# Start services
docker compose up -d

# Run sync job
docker compose exec app npm run sync:meta:loop
```

### Cron Job (Alternative to Loop Mode)

```cron
# Sync every hour
0 * * * * cd /app && npm run sync:meta

# Sync performance data every 2 hours
0 */2 * * * cd /app && npm run sync:performance
```

## Troubleshooting

### Sync Taking Too Long

- Check network latency to Meta API
- Reduce batch sizes
- Archive old campaigns
- Run performance sync separately

### Missing Data

- Check Meta Ad Account permissions
- Verify API scopes in OAuth flow
- Check field names in sync-service.ts
- Enable debug logging

### Webhook Not Working

- Verify APP_SECRET matches
- Check webhook URL is publicly accessible
- Test signature verification manually
- Review webhook logs in Meta Developer Portal

## Next Steps

1. ✅ **Completed**: Meta sync service is fully implemented
2. **Next**: Implement API routes for manual triggers
3. **Next**: Build optimization engine using performance data
4. **Next**: Add dashboard to visualize sync status
5. **Next**: Implement bulk operations via Meta Batch API

## Resources

- [Meta Marketing API Documentation](https://developers.facebook.com/docs/marketing-apis)
- [Meta Webhooks Guide](https://developers.facebook.com/docs/graph-api/webhooks)
- [Rate Limiting Best Practices](https://developers.facebook.com/docs/graph-api/overview/rate-limiting)
- [Error Codes Reference](https://developers.facebook.com/docs/graph-api/using-graph-api/error-handling)

---

**Last Updated**: December 10, 2024  
**Status**: ✅ Complete and Ready for Production
