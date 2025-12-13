# Meta Sync Service - Quick Reference

## 
```bash
# Start services
npm run docker:up

# Single sync
npm run sync:meta

# Continuous sync
npm run sync:meta:loop

# With performance data
npm run sync:meta:performance
```

## 
| Command | Description |
|---------|-------------|
| `npm run sync:meta` | Single entity sync (campaigns, ad sets, ads) |
| `npm run sync:meta:loop` | Continuous entity sync (default: every 60 min) |
| `npm run sync:meta:performance` | Sync entities + performance data |
| `npm run sync:performance` | Sync performance data only (yesterday) |
| `npm run sync:performance:loop` | Continuous performance sync |

echo Configuration## 

```bash
# .env
META_API_VERSION=v21.0
META_APP_ID=your_app_id
META_APP_SECRET=your_app_secret
META_SYNC_INTERVAL_MINUTES=60
PERFORMANCE_SYNC_INTERVAL_MINUTES=60
```

## 
```bash
# Custom interval (30 minutes)
ts-node scripts/sync-meta.ts --loop --interval=30

# Custom date preset
ts-node scripts/sync-performance.ts --preset=last_7d

# Available presets: today, yesterday, last_7d, last_30d, this_month, last_month, lifetime
```

## 
### Sync Entities
```typescript
import { syncMetaConnection } from '@/lib/services/meta-sync/sync-service';

const result = await syncMetaConnection(connection, syncPerformance);
// Returns: { campaignsSynced, adSetsSynced, adsSynced, durationMs }
```

### Sync Performance
```typescript
import { syncAllPerformanceData } from '@/lib/services/meta-sync/sync-service';

const stats = await syncAllPerformanceData(connection, 'last_7d');
// Returns: { campaigns, adSets, ads }
```

### Fetch from API
```typescript
import { fetchGraphEdges } from '@/lib/services/meta-sync/graph-client';

const campaigns = await fetchGraphEdges<GraphCampaign>(
  accessToken,
  `${accountId}/campaigns`,
  { fields: 'id,name,status', limit: '100' },
  userId
);
```

## 
```typescript
// pages/api/webhooks/meta.ts
import { handleMetaWebhook, verifyMetaWebhookSignature } from '@/lib/webhooks/meta';

export async function POST(req: Request) {
  const signature = req.headers.get('x-hub-signature');
  const body = await req.text();
  
  if (!verifyMetaWebhookSignature(signature, body)) {
    return new Response('Invalid signature', { status: 401 });
  }
  
  await handleMetaWebhook(JSON.parse(body));
  return new Response('OK');
}
```

## 
| Code | Meaning | Action |
|------|---------|--------|
| 190 | Token expired | Re-authenticate user |
| 17 | Rate limited | Automatic retry with backoff |
| 100 | Invalid param | Check request parameters |
| 2/4 | Temp error | Automatic retry |

## 
- **Meta Limit:** 200 calls/hour per user
- **Our Limit:** 180 calls/hour (conservative)
- **Warning:** At 162 calls (90%)
- **Tracking:** Redis with 1-hour TTL

## 
Check logs for:
```json
{
  "level": "info",
  "message": "Meta connection synced",
  "campaignCount": 5,
  "adSetCount": 15,
  "adCount": 45,
  "durationMs": 2341
}
```

## 
**Connection Expired?**
```typescript
// User needs to re-authenticate via OAuth
```

**Rate Limited?**
```bash
# Reduce frequency or use batch requests
--interval=120  # Sync every 2 hours instead
```

**No Performance Data?**
```bash
# Use longer date range
--preset=last_30d
```

## 
- Main README: `lib/services/meta-sync/README.md`
- Implementation: `META_SYNC_IMPLEMENTATION.md`
- Strategy: `META_ADS_OPTIMIZATION_STRATEGY.md`
