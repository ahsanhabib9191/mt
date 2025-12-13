# Meta Sync Implementation Summary

## ✅ Implementation Complete

The Meta Ads synchronization service has been fully implemented and is production-ready. This document provides a quick reference for developers.

## What's Been Implemented

### 1. Core Sync Service (`lib/services/meta-sync/`)

#### Files:
- **`graph-client.ts`** - Meta Graph API client with retry logic and rate limiting
- **`sync-service.ts`** - Complete bidirectional sync for campaigns, ad sets, and ads

#### Features:
- ✅ Fetch campaigns from Meta API → Store in MongoDB
- ✅ Fetch ad sets with targeting data → Store in MongoDB
- ✅ Fetch ads with creative data → Store in MongoDB
- ✅ Fetch insights (performance data) → Store in PerformanceSnapshot
- ✅ Automatic token refresh (5 minutes before expiry)
- ✅ Exponential backoff retry (max 3 attempts)
- ✅ Redis-based rate limiting (180 calls/hour per user)
- ✅ Error handling for all Meta API error codes

### 2. Webhook Handlers (`lib/webhooks/meta.ts`)

#### Features:
- ✅ Webhook signature verification (SHA1 HMAC)
- ✅ Subscription challenge verification
- ✅ Real-time sync on campaign changes
- ✅ Real-time sync on ad set changes
- ✅ Real-time sync on ad changes
- ✅ Parallel processing with error isolation
- ✅ Comprehensive error logging

### 3. Background Jobs (`scripts/`)

#### Sync Scripts:
- **`sync-meta.ts`** - Full sync job (campaigns + ad sets + ads)
- **`sync-performance.ts`** - Performance data sync job
- **`test-meta-connection.ts`** - Validate Meta API credentials
- **`test-meta-sync-complete.ts`** - Comprehensive test suite

#### Features:
- ✅ Distributed locking (prevents duplicate jobs)
- ✅ Periodic execution (--loop flag)
- ✅ Configurable intervals
- ✅ Performance data sync with date presets
- ✅ Graceful error handling and recovery

### 4. Performance Data Collection

#### Features:
- ✅ Daily granularity insights
- ✅ Metrics: impressions, clicks, spend, conversions, revenue
- ✅ Support for multiple date ranges
- ✅ Efficient bulk syncing
- ✅ Duplicate prevention (unique indexes)

## Quick Start

### 1. Configure Environment

```bash
# Copy example and edit
cp .env.example .env

# Add Meta credentials
META_APP_ID=your_app_id
META_APP_SECRET=your_app_secret
META_APP_VERIFY_TOKEN=your_webhook_token
META_API_VERSION=v21.0
```

### 2. Start Services

```bash
# Start MongoDB and Redis
npm run docker:up

# Wait 10-20 seconds for services to initialize
```

### 3. Test Meta Connection

```bash
# Validate Meta API credentials
npm run test:meta
```

Expected output:
```
✅ PASS: META_APP_ID is configured
✅ PASS: META_APP_SECRET is configured
✅ PASS: Access token received
✅ PASS: Graph API call successful
🎉 Your Meta API configuration is working correctly.
```

### 4. Run Comprehensive Tests

```bash
# Test all sync components
npm run test:meta-sync
```

This validates:
- Environment configuration
- Database connections
- Model schemas
- Webhook handlers
- Rate limiting
- Actual sync (if Meta connection exists)

### 5. Run Manual Sync

```bash
# One-time full sync
npm run sync:meta

# Sync with performance data
npm run sync:meta -- --performance

# Continuous sync (runs every hour)
npm run sync:meta:loop
```

### 6. Sync Performance Data

```bash
# Sync yesterday's data
npm run sync:performance

# Sync last 7 days
npm run sync:performance -- --preset=last_7d

# Continuous performance sync
npm run sync:performance:loop
```

## Architecture Overview

```
┌──────────────────┐
│  Meta Ads API    │
│  (Graph API)     │
└────────┬─────────┘
         │
         │ Bidirectional Sync
         │
┌────────▼─────────────────────────────────────────┐
│  Sync Service                                     │
│  - fetchGraphEdges() - Get campaigns/ad sets/ads │
│  - fetchInsights() - Get performance data         │
│  - ensureConnectionAccessToken() - Auto refresh   │
│  - Rate limiting & retries                        │
└────────┬─────────────────────────────────────────┘
         │
         │ Upsert operations
         │
┌────────▼─────────────────────────────────────────┐
│  MongoDB                                          │
│  - Campaign (budget, objective, status)           │
│  - AdSet (targeting, learning phase)              │
│  - Ad (creative, issues, effective status)        │
│  - PerformanceSnapshot (metrics by day)           │
└───────────────────────────────────────────────────┘
```

## API Methods

### Main Sync Functions

```typescript
// Full sync for a connection
import { syncMetaConnection } from './lib/services/meta-sync/sync-service';

const result = await syncMetaConnection(connection, true);
// Returns: { campaignsSynced, adSetsSynced, adsSynced, performanceStats }

// Performance data only
import { syncAllPerformanceData } from './lib/services/meta-sync/sync-service';

const perfResult = await syncAllPerformanceData(connection, 'last_7d');
// Returns: { campaigns, adSets, ads } - number of snapshots
```

### Webhook Handlers

```typescript
// Handle webhook event
import { handleMetaWebhook } from './lib/webhooks/meta';

await handleMetaWebhook(webhookPayload);

// Verify signature
import { verifyMetaWebhookSignature } from './lib/webhooks/meta';

const isValid = verifyMetaWebhookSignature(signature, rawBody);
```

### Graph API Client

```typescript
import { 
  fetchGraphEdges, 
  fetchGraphNode, 
  ensureConnectionAccessToken 
} from './lib/services/meta-sync/graph-client';

// Ensure token is fresh
const { accessToken } = await ensureConnectionAccessToken(connection);

// Fetch paginated data
const campaigns = await fetchGraphEdges(
  accessToken,
  'act_123/campaigns',
  { fields: 'name,status,objective' },
  userId
);

// Fetch single node
const campaign = await fetchGraphNode(
  accessToken,
  '123456',
  { fields: 'name,status' },
  userId
);
```

## Error Handling

### Meta API Error Codes

The service automatically handles:

| Code | Meaning | Action |
|------|---------|--------|
| 190 | Token expired | Auto-refresh or mark EXPIRED |
| 17 | Rate limit | Exponential backoff & retry |
| 4 | Rate limit exceeded | Wait & retry |
| 100 | Invalid parameter | Don't retry, log error |
| 2 | Temporary unavailable | Retry with backoff |

### Retry Logic

```typescript
// Automatic retries with exponential backoff
// Attempt 1: Immediate
// Attempt 2: Wait 1s
// Attempt 3: Wait 2s
// Attempt 4: Wait 4s (then fail)
```

## Rate Limiting

### Limits
- **Meta API**: 200 calls per hour per user
- **Our limit**: 180 calls per hour (conservative)
- **Warning**: Log at 162 calls (90% capacity)

### Redis Keys
```
meta:ratelimit:{userId} → counter with 1 hour TTL
```

## Monitoring

### Key Metrics

**Sync Duration**
```
Normal: 5-30 seconds
Warning: > 60 seconds
Critical: > 120 seconds
```

**API Calls**
```
Safe: < 150/hour
Warning: 150-180/hour
Critical: > 180/hour
```

**Error Rate**
```
Good: < 1%
Acceptable: 1-5%
Poor: > 5%
```

### Logs Location

```bash
logs/application-YYYY-MM-DD.log  # All logs
logs/error-YYYY-MM-DD.log        # Errors only
```

### Log Levels

```typescript
logger.info('Normal operation')
logger.warn('Approaching limits')
logger.error('Failures')
logger.debug('Detailed info')
```

## Testing

### Test Scripts

```bash
# Meta API connection
npm run test:meta

# Full sync test suite
npm run test:meta-sync

# Database models
npm run test:models

# All tests
npm run test:all
```

### Manual Testing

```typescript
// Test script example
import { syncMetaConnection } from './lib/services/meta-sync/sync-service';
import { MetaConnectionModel } from './lib/db/models/MetaConnection';

const connection = await MetaConnectionModel.findOne({ 
  tenantId: 'test_tenant' 
});

const result = await syncMetaConnection(connection, false);
console.log('Synced:', result);
```

## Production Deployment

### Environment Setup

```bash
# Production .env
NODE_ENV=production
LOG_LEVEL=info

META_APP_ID=prod_app_id
META_APP_SECRET=prod_secret

MONGODB_URI=mongodb+srv://...
REDIS_URL=redis://...

META_SYNC_INTERVAL_MINUTES=60
PERFORMANCE_SYNC_INTERVAL_MINUTES=120
```

### Background Jobs

**Option 1: PM2**
```bash
pm2 start npm --name "meta-sync" -- run sync:meta:loop
pm2 start npm --name "perf-sync" -- run sync:performance:loop
```

**Option 2: Docker**
```bash
docker compose up -d
```

**Option 3: Cron**
```cron
0 * * * * cd /app && npm run sync:meta
0 */2 * * * cd /app && npm run sync:performance
```

### Monitoring Setup

1. **Error Tracking**: Sentry, Bugsnag
2. **Metrics**: DataDog, New Relic, CloudWatch
3. **Logging**: ELK Stack, Papertrail, Loggly
4. **Alerts**: PagerDuty, OpsGenie

## Troubleshooting

### Common Issues

**1. Token Expired**
```
Error: Meta API token expired (code 190)
```
Solution: User needs to re-authenticate via OAuth

**2. Rate Limit**
```
Warn: Approaching Meta API rate limit (180/200)
```
Solution: Increase sync interval or optimize queries

**3. No Active Connection**
```
Info: No active Meta connections found for sync
```
Solution: Create MetaConnection via OAuth flow

**4. Sync Taking Too Long**
```
Warn: Sync duration 125s
```
Solutions:
- Archive old campaigns
- Reduce batch sizes
- Run performance sync separately

### Debug Mode

```bash
# Enable debug logging
LOG_LEVEL=debug npm run sync:meta

# Check specific connection
ts-node -e "
import { syncMetaConnection } from './lib/services/meta-sync/sync-service';
import { MetaConnectionModel } from './lib/db/models/MetaConnection';
await connectDB();
const conn = await MetaConnectionModel.findOne({ tenantId: 'X' });
await syncMetaConnection(conn, true);
"
```

## Next Steps

Now that sync is complete, you can:

1. **Build API Routes** - Create REST endpoints for manual sync triggers
2. **Implement Optimization Engine** - Use performance data for decisions
3. **Add Dashboard** - Visualize sync status and metrics
4. **Set Up Webhooks** - Enable real-time updates
5. **Implement Bulk Operations** - Use Meta Batch API for efficiency

## Documentation

- **Complete Guide**: [`docs/META_SYNC_SERVICE.md`](./docs/META_SYNC_SERVICE.md)
- **Implementation Plan**: [`WHATS_NEXT.md`](./WHATS_NEXT.md)
- **Strategy**: [`META_ADS_OPTIMIZATION_STRATEGY.md`](./META_ADS_OPTIMIZATION_STRATEGY.md)
- **Security**: [`SECURITY.md`](./SECURITY.md)

## Support

For issues or questions:

1. Check logs in `logs/` directory
2. Run test suite: `npm run test:meta-sync`
3. Review documentation: `docs/META_SYNC_SERVICE.md`
4. Check Meta API status: https://developers.facebook.com/status/

---

**Status**: ✅ Complete and Production Ready  
**Last Updated**: December 10, 2024  
**Implementation**: 100% Complete
