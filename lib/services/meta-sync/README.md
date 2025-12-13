# Meta Sync Service

Complete implementation of bidirectional sync between Meta/Facebook Ads API and the local database.

## Features

### ✅ Implemented

1. **Bidirectional Data Sync**
   - Fetch campaigns, ad sets, and ads from Meta API
   - Store entities in local MongoDB database
   - Upsert logic prevents duplicates
   - Maintains relationships (Campaign → AdSet → Ad)

2. **Performance Data Collection**
   - Fetch insights from Meta Ads API
   - Daily granularity performance snapshots
   - Tracks impressions, clicks, spend, conversions, revenue
   - Separate sync for campaigns, ad sets, and ads

3. **Advanced Error Handling**
   - Exponential backoff retry logic (max 3 retries)
   - Handles specific Meta API error codes:
     - **190**: Token expired → Mark connection as expired
     - **17/4/2**: Rate limit/temporary errors → Retry with backoff
     - **100**: Invalid parameter → Don't retry
   - Custom `MetaAPIError` class with detailed error info

4. **Rate Limiting**
   - Redis-backed rate limit tracking
   - Conservative limit: 180 calls/hour (out of 200 allowed)
   - Per-user rate limit tracking
   - Warnings when approaching limits

5. **Token Management**
   - Automatic token refresh 5 minutes before expiry
   - Handles OAuth token exchange
   - Updates encrypted tokens in database
   - Connection status management

6. **Webhook Handlers**
   - Real-time updates from Meta
   - Webhook signature verification (SHA1 HMAC)
   - Challenge verification for subscription
   - Handles campaign, ad set, and ad changes
   - Parallel processing with error isolation

7. **Background Jobs**
   - Scheduled sync with Redis locking
   - Single-run or loop mode
   - Configurable intervals
   - Performance sync job
   - Detailed logging and statistics

## Architecture

```
lib/services/meta-sync/
├── graph-client.ts      # Meta Graph API client with retry logic
└── sync-service.ts      # Sync orchestration and data mapping

lib/webhooks/
└── meta.ts              # Webhook handlers

scripts/
├── sync-meta.ts         # Entity sync job
└── sync-performance.ts  # Performance data sync job
```

## Usage

### Sync Entities (Campaigns, Ad Sets, Ads)

**Single sync run:**
```bash
npm run sync:meta
```

**Continuous sync (every hour by default):**
```bash
npm run sync:meta:loop
```

**Sync with performance data:**
```bash
npm run sync:meta:performance
```

**Custom interval (every 30 minutes):**
```bash
ts-node scripts/sync-meta.ts --loop --interval=30
```

### Sync Performance Data Only

**Single run (yesterday's data):**
```bash
npm run sync:performance
```

**Continuous sync:**
```bash
npm run sync:performance:loop
```

**Custom date preset:**
```bash
ts-node scripts/sync-performance.ts --preset=last_7d --loop
```

**Available date presets:**
- `today` - Today's data
- `yesterday` - Yesterday's data (default)
- `last_7d` - Last 7 days
- `last_30d` - Last 30 days
- `this_month` - Current month
- `last_month` - Previous month
- `lifetime` - All available data

## API Functions

### Graph Client (`graph-client.ts`)

#### `ensureConnectionAccessToken(connection)`
Ensures access token is valid, refreshes if needed.

```typescript
const { connection, accessToken } = await ensureConnectionAccessToken(conn);
```

#### `fetchGraphEdges<T>(accessToken, path, params, userId?)`
Fetch paginated edges from Graph API.

```typescript
const campaigns = await fetchGraphEdges<GraphCampaign>(
  accessToken,
  `${accountId}/campaigns`,
  { fields: 'id,name,status', limit: '100' },
  userId
);
```

#### `fetchGraphNode<T>(accessToken, path, params, userId?)`
Fetch a single node from Graph API.

```typescript
const campaign = await fetchGraphNode<GraphCampaign>(
  accessToken,
  campaignId,
  { fields: 'id,name,status' }
);
```

#### `fetchInsights<T>(accessToken, objectId, params, userId?)`
Fetch insights data with pagination.

```typescript
const insights = await fetchInsights<GraphInsights>(
  accessToken,
  campaignId,
  {
    fields: 'impressions,clicks,spend',
    date_preset: 'last_7d',
    time_increment: '1'
  },
  userId
);
```

#### `batchRequest(accessToken, requests, userId?)`
Execute multiple requests in a single API call.

```typescript
const results = await batchRequest(
  accessToken,
  [
    { method: 'GET', relative_url: 'campaign1?fields=id,name' },
    { method: 'GET', relative_url: 'campaign2?fields=id,name' }
  ],
  userId
);
```

### Sync Service (`sync-service.ts`)

#### `syncMetaConnection(connection, syncPerformance?)`
Sync all entities for a connection.

```typescript
const result = await syncMetaConnection(connection, true);
// Returns: { campaignsSynced, adSetsSynced, adsSynced, durationMs, performanceStats }
```

#### `syncAllPerformanceData(connection, datePreset?)`
Sync performance data for all entities.

```typescript
const stats = await syncAllPerformanceData(connection, 'last_7d');
// Returns: { campaigns, adSets, ads }
```

#### `syncPerformanceData(connection, entityType, entityId, datePreset?)`
Sync performance data for a specific entity.

```typescript
const count = await syncPerformanceData(
  connection,
  'CAMPAIGN',
  'campaign_123',
  'yesterday'
);
```

#### Webhook Sync Functions

```typescript
await syncCampaignFromWebhook(connection, campaignId);
await syncAdSetFromWebhook(connection, adSetId);
await syncAdFromWebhook(connection, adId);
```

### Webhook Handlers (`meta.ts`)

#### `resolveMetaWebhookChallenge(query)`
Verify webhook subscription.

```typescript
const challenge = resolveMetaWebhookChallenge(req.query);
if (challenge) return res.send(challenge);
```

#### `verifyMetaWebhookSignature(signature, rawBody)`
Verify webhook authenticity.

```typescript
const isValid = verifyMetaWebhookSignature(
  req.headers['x-hub-signature'],
  rawBody
);
```

#### `handleMetaWebhook(body)`
Process webhook payload.

```typescript
await handleMetaWebhook(req.body);
```

## Configuration

### Environment Variables

```bash
# Meta API Configuration
META_API_VERSION=v21.0              # Graph API version
META_APP_ID=your_app_id             # Meta App ID
META_APP_SECRET=your_app_secret     # Meta App Secret
META_APP_VERIFY_TOKEN=your_token    # Webhook verification token

# Sync Configuration
META_SYNC_INTERVAL_MINUTES=60       # Entity sync interval (default: 60)
PERFORMANCE_SYNC_INTERVAL_MINUTES=60 # Performance sync interval (default: 60)

# Database
MONGODB_URI=mongodb://localhost:27017/meta-ads
REDIS_URL=redis://localhost:6379

# Encryption
ENCRYPTION_KEY=your_64_char_hex_key # 32 bytes for AES-256
```

### Rate Limits

Meta imposes the following limits:
- **200 API calls per hour per user**
- **200 API calls per hour per app per user**

The sync service:
- Tracks calls in Redis with 1-hour TTL
- Uses conservative limit of 180 calls/hour
- Warns at 90% (162 calls)
- Retries with exponential backoff on limit errors

## Error Handling

### Meta API Errors

The service handles these error codes specifically:

| Code | Meaning | Action |
|------|---------|--------|
| 190 | Token expired | Mark connection expired, caller should re-authenticate |
| 17 | Rate limit reached | Wait 1 minute, retry with exponential backoff |
| 4 | Rate limit exceeded | Same as code 17 |
| 2 | API temporarily unavailable | Retry with exponential backoff |
| 100 | Invalid parameter | Log error, don't retry |

### Retry Logic

- **Max retries:** 3
- **Backoff:** Exponential (2^n seconds)
  - 1st retry: 1 second
  - 2nd retry: 2 seconds
  - 3rd retry: 4 seconds
- **Applies to:** Network errors, temporary API errors, rate limits

### Connection Status

Connections can have these statuses:
- `ACTIVE`/`CONNECTED` - Ready to sync
- `EXPIRED` - Token expired, needs re-authentication
- `DISCONNECTED` - Manually disconnected
- `ERROR` - Sync errors occurred

## Data Mapping

### Campaign Fields

```typescript
{
  campaignId: string;     // Meta campaign ID
  accountId: string;      // Meta ad account ID
  name: string;           // Campaign name
  objective: string;      // OUTCOME_TRAFFIC, OUTCOME_LEADS, etc.
  status: string;         // ACTIVE, PAUSED, ARCHIVED, DRAFT
  budget: number;         // Daily budget in account currency
  startDate?: Date;       // Campaign start date
  endDate?: Date;         // Campaign end date
}
```

### AdSet Fields

```typescript
{
  adSetId: string;             // Meta ad set ID
  campaignId: string;          // Parent campaign ID
  accountId: string;           // Meta ad account ID
  name: string;                // Ad set name
  status: string;              // ACTIVE, PAUSED, ARCHIVED
  budget: number;              // Daily budget
  targeting: ITargeting;       // Audience targeting
  learningPhaseStatus: string; // LEARNING, ACTIVE, LEARNING_LIMITED, NOT_STARTED
  optimizationGoal: string;    // LINK_CLICKS, CONVERSIONS, etc.
  deliveryStatus?: string;     // Delivery status from Meta
  startDate?: Date;
  endDate?: Date;
}
```

### Ad Fields

```typescript
{
  adId: string;            // Meta ad ID
  adSetId: string;         // Parent ad set ID
  campaignId: string;      // Parent campaign ID (denormalized)
  accountId: string;       // Meta ad account ID
  name: string;            // Ad name
  status: string;          // ACTIVE, PAUSED, ARCHIVED, DRAFT
  creative: IAdCreative;   // Creative details
  effectiveStatus: string; // ACTIVE, PAUSED, DISAPPROVED, etc.
  issues: IAdIssue[];      // Policy violations and errors
}
```

### Performance Snapshot

```typescript
{
  entityType: 'CAMPAIGN' | 'AD_SET' | 'AD';
  entityId: string;        // Campaign/AdSet/Ad ID
  date: Date;              // Snapshot date (normalized to start of day)
  impressions: number;     // Total impressions
  clicks: number;          // Total clicks
  spend: number;           // Total spend in account currency
  conversions: number;     // Total conversions (purchases, leads, etc.)
  revenue?: number;        // Total revenue (if available)
}
```

## Logging

All operations are logged with Winston logger:

**Info logs:**
- Sync cycle started/completed
- Connection synced with entity counts
- Performance data synced

**Warning logs:**
- Approaching rate limit (>90%)
- Webhook for unknown ad account
- Retry attempts

**Error logs:**
- API call failures with error details
- Token refresh failures
- Sync failures with full context

**Log format:**
```json
{
  "level": "info",
  "message": "Meta connection synced",
  "tenantId": "tenant_123",
  "adAccountId": "act_123456",
  "campaignCount": 5,
  "adSetCount": 15,
  "adCount": 45,
  "durationMs": 2341,
  "timestamp": "2024-12-10T00:00:00.000Z"
}
```

## Testing

### Prerequisites

1. Valid Meta App with appropriate permissions
2. Active Meta Business account
3. Test ad account with campaigns

### Test Sync

```bash
# Start database and Redis
npm run docker:up

# Run single sync
npm run sync:meta

# Expected output:
# ✅ MongoDB connected
# ℹ️ Starting Meta sync job
# ℹ️ Connection synced successfully
# ✅ Sync cycle completed
```

### Test Performance Sync

```bash
npm run sync:performance

# Expected output:
# ℹ️ Performance data synced for connection
# ℹ️ Performance sync cycle completed
```

## Production Deployment

### Recommended Setup

1. **Entity Sync Job** - Run every 4 hours
   ```bash
   ts-node scripts/sync-meta.ts --loop --interval=240
   ```

2. **Performance Sync Job** - Run every hour
   ```bash
   ts-node scripts/sync-performance.ts --loop --interval=60
   ```

3. **Webhook Endpoint** - Real-time updates
   ```typescript
   // In your Next.js API route
   import { handleMetaWebhook, verifyMetaWebhookSignature } from '@/lib/webhooks/meta';
   
   export async function POST(req: Request) {
     const signature = req.headers.get('x-hub-signature');
     const body = await req.text();
     
     if (!verifyMetaWebhookSignature(signature, body)) {
       return Response.json({ error: 'Invalid signature' }, { status: 401 });
     }
     
     await handleMetaWebhook(JSON.parse(body));
     return Response.json({ success: true });
   }
   ```

### Process Management

Use PM2 or similar for production:

```bash
# ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'meta-sync-entities',
      script: 'dist/scripts/sync-meta.js',
      args: '--loop --interval=240',
      instances: 1,
      autorestart: true,
      max_memory_restart: '500M'
    },
    {
      name: 'meta-sync-performance',
      script: 'dist/scripts/sync-performance.js',
      args: '--loop --interval=60',
      instances: 1,
      autorestart: true,
      max_memory_restart: '500M'
    }
  ]
};
```

### Monitoring

Monitor these metrics:
- Sync success/failure rate
- API error rates by code
- Sync duration
- Rate limit usage
- Token refresh failures
- Webhook processing success rate

## Troubleshooting

### Connection Expired

**Problem:** `status: 'EXPIRED'` in database

**Solution:** User needs to re-authenticate:
```typescript
// Redirect user to Meta OAuth flow
const authUrl = `https://www.facebook.com/v21.0/dialog/oauth?client_id=${appId}&redirect_uri=${redirectUri}&scope=${scopes}`;
```

### Rate Limit Exceeded

**Problem:** Error code 17 or warning logs

**Solution:**
- Reduce sync frequency
- Use batch requests where possible
- Implement intelligent sync (only changed entities)

### Missing Performance Data

**Problem:** No insights returned

**Solution:**
- Check entity is not in learning phase
- Verify entity has recent activity
- Use longer date preset (`last_30d` instead of `yesterday`)

### Webhook Not Working

**Problem:** Webhooks not being received

**Solution:**
1. Verify webhook subscription in Meta App settings
2. Check `META_APP_VERIFY_TOKEN` matches
3. Ensure HTTPS endpoint is accessible
4. Verify signature validation is working

## Next Steps

### Recommended Enhancements

1. **Intelligent Sync**
   - Only sync entities modified since last sync
   - Use `lastSyncedAt` timestamp in queries
   - Implement change detection

2. **Batch Operations**
   - Use batch API for multiple entity fetches
   - Reduce API call count
   - Improve sync performance

3. **Caching Layer**
   - Cache frequently accessed entities in Redis
   - Set appropriate TTLs (5-15 minutes)
   - Invalidate on webhook updates

4. **Monitoring Dashboard**
   - Real-time sync status
   - API usage metrics
   - Error rate tracking
   - Performance trends

5. **Advanced Error Recovery**
   - Automatic retry scheduling for failed syncs
   - Dead letter queue for persistent failures
   - Alert notifications for critical errors

---

**Status:** ✅ Implementation Complete  
**Last Updated:** December 10, 2024  
**Version:** 1.0.0
