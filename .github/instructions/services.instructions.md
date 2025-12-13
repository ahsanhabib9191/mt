---
description: Instructions for service layer and external API integrations
applyTo: "lib/services/**/*.ts"
---

# Services Instructions

## Service Layer Patterns

Services contain business logic and external API integrations. Keep services stateless and testable.

### Meta Graph API Integration

Reference `lib/services/meta-sync/` for Meta/Facebook Ads API patterns:

#### Token Management

- Store OAuth tokens encrypted in `MetaConnection` model
- Automatically refresh tokens 5 minutes before expiry
- Handle token refresh failures gracefully
- Use `ensureConnectionAccessToken()` before API calls

**Example:**
```typescript
const accessToken = await graphClient.ensureConnectionAccessToken(connectionId);
```

#### API Request Patterns

Always implement:

1. **Retry Logic**: Exponential backoff for transient failures
2. **Rate Limit Handling**: Respect Meta's 200 calls/hour per user limit
3. **Error Handling**: Handle common Graph API errors appropriately
4. **Pagination**: Use cursor-based pagination for large result sets
5. **Batch Requests**: Minimize API calls by batching when possible

**Retry Logic Example:**
```typescript
async function fetchWithRetry(url: string, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fetch(url);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await sleep(Math.pow(2, i) * 1000); // Exponential backoff
    }
  }
}
```

#### Rate Limit Handling

Meta Graph API limits: **200 calls per hour per user**

- Track API call count in Redis
- Implement exponential backoff when approaching limit
- Handle error code 17 (user request limit reached)
- Use batch requests to reduce call count

**Example:**
```typescript
const rateLimitKey = `meta:ratelimit:${userId}`;
const count = await redis.incr(rateLimitKey);
await redis.expire(rateLimitKey, 3600); // 1 hour TTL

if (count > 180) {
  logger.warn('Approaching rate limit', { userId, count });
}
```

#### Common Graph API Errors

Handle these error codes appropriately:

- **190**: OAuth token expired → Re-authenticate user
- **17**: Throttled → Back off and retry with exponential delay
- **100**: Invalid parameter → Validation error, don't retry
- **2**: API service temporarily unavailable → Retry with backoff
- **4**: API rate limit exceeded → Wait and retry

**Example:**
```typescript
if (error.code === 190) {
  await refreshAccessToken(connectionId);
  return retry();
} else if (error.code === 17) {
  await sleep(60000); // Wait 1 minute
  return retry();
}
```

#### Pagination

Use cursor-based pagination for Meta API:

```typescript
async function fetchAllPages(endpoint: string) {
  const results = [];
  let after: string | null = null;
  
  do {
    const params = after ? { after, limit: 100 } : { limit: 100 };
    const response = await fetchGraphEdges(endpoint, params);
    results.push(...response.data);
    after = response.paging?.cursors?.after || null;
  } while (after);
  
  return results;
}
```

### Caching Strategies

Use Redis for caching API responses:

- Cache frequently accessed data (campaigns, ad accounts)
- Set appropriate TTLs based on data volatility
- Invalidate cache on updates
- Use cache keys with tenant/user isolation

**Example:**
```typescript
const cacheKey = `meta:campaign:${tenantId}:${campaignId}`;
const cached = await redis.get(cacheKey);

if (cached) {
  return JSON.parse(cached);
}

const data = await fetchFromAPI();
await redis.setex(cacheKey, 3600, JSON.stringify(data)); // 1 hour TTL
return data;
```

### Service Structure

Keep services focused and single-purpose:

```typescript
export class MetaSyncService {
  constructor(
    private graphClient: GraphClient,
    private logger: Logger
  ) {}
  
  async syncCampaigns(connectionId: string): Promise<void> {
    // Implementation
  }
  
  async syncAdSets(campaignId: string): Promise<void> {
    // Implementation
  }
}
```

### Error Handling

- Log all errors with context (userId, tenantId, endpoint)
- Throw descriptive errors for the caller to handle
- Never swallow errors silently
- Use custom error classes when appropriate

**Example:**
```typescript
try {
  await apiCall();
} catch (error) {
  logger.error('API call failed', {
    endpoint,
    userId,
    error: error.message,
    stack: error.stack
  });
  throw new APIError('Failed to sync data', error);
}
```

### Logging

Use structured logging with Winston:

```typescript
import logger from '../../utils/logger';

logger.info('Starting sync', { connectionId, tenantId });
logger.debug('API request', { endpoint, params });
logger.error('Sync failed', { error: error.message, connectionId });
```

### Testing

Create test scripts for services:

```bash
npm run test:db  # Database operations
```

Mock external API calls in tests to avoid rate limits and costs.

### Reference Existing Services

Study patterns from:
- `lib/services/meta-sync/graph-client.ts` - API client with retry logic
- `lib/services/meta-sync/sync-service.ts` - Sync operations with database
