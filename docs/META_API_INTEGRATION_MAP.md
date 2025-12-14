# Meta API Integration Map

A quick, tactical map for how this repository integrates with the Meta (Facebook) Graph API. Use this to understand where requests originate, how tokens flow, and where data lands in MongoDB/Redis.

## End-to-End Flow

1. **Auth & Tokens**
   - OAuth flow issues short-lived user tokens (see `docs/META_OAUTH_INTEGRATION.md`).
   - Tokens are stored encrypted in the `MetaConnection` model (`lib/db/models/MetaConnection.ts`).
   - `ensureConnectionAccessToken()` in `lib/services/meta-sync/graph-client.ts` refreshes tokens ~5 minutes before expiry.
2. **API Requests**
   - All Graph calls go through the graph client (`lib/services/meta-sync/graph-client.ts`) with retry, backoff, and rate-limit guards.
   - Redis tracks per-user call counts (`meta:ratelimit:{userId}`) to stay under 200 calls/hour.
3. **Business Logic**
   - `lib/services/meta-sync/sync-service.ts` orchestrates fetch → upsert flows for campaigns, ad sets, ads, and insights.
4. **Persistence**
   - MongoDB models capture entities:
     - Campaigns → `lib/db/models/Campaign.ts`
     - Ad Sets → `lib/db/models/AdSet.ts`
     - Ads → `lib/db/models/Ad.ts`
     - Performance snapshots → `lib/db/models/PerformanceSnapshot.ts`
5. **Webhooks**
   - `lib/webhooks/meta.ts` verifies signatures, resolves challenges, and triggers targeted syncs (campaign/ad set/ad refresh).

## API Surface Mapping

| Graph Object | Endpoint | Entry Point | Storage |
| --- | --- | --- | --- |
| Ad Account | `/{ad_account_id}?fields=...` | `fetchGraphNode` → `syncMetaConnection` | `Campaign`/`AdSet`/`Ad` context |
| Campaigns | `/{ad_account_id}/campaigns` | `fetchGraphEdges` → `upsertCampaignFromGraph` | `Campaign` |
| Ad Sets | `/{campaign_id}/adsets` | `fetchGraphEdges` → `upsertAdSetFromGraph` | `AdSet` |
| Ads | `/{adset_id}/ads` | `fetchGraphEdges` → `upsertAdFromGraph` | `Ad` |
| Insights | `/{object_id}/insights` | `fetchInsights` → `upsertPerformanceSnapshot` | `PerformanceSnapshot` |

## Runtime Entry Points

- **Scheduled/Manual Syncs**: `scripts/sync-meta.ts` and `scripts/sync-performance.ts` start full or performance-only syncs (loop flags supported).
- **Webhook-Triggered Syncs**: `lib/webhooks/meta.ts` dispatches granular refreshes when Meta sends changes.
- **Tests/Verification**: `npm run test:meta` and `npm run test:meta-sync` validate connectivity and sync correctness.

## Error, Rate, and Safety Guardrails

- **Rate Limits**: Warnings at ~180 calls/hour; backoff and retries for Meta error codes 17 (user request limit) and 4 (application limit); no retry for code 100 (invalid parameter).
- **Token Expiry**: Code 190 triggers refresh; if refresh fails, connection is marked expired.
- **Security**: No tokens logged; encryption via `lib/utils/crypto.ts`; signatures verified for webhooks.

## Where to Dive Deeper

- OAuth specifics: [`META_OAUTH_INTEGRATION.md`](META_OAUTH_INTEGRATION.md)
- Setup checklist: [`META_API_SETUP.md`](META_API_SETUP.md)
- Sync internals: [`META_SYNC_SERVICE.md`](META_SYNC_SERVICE.md)
- Optimization logic: [`META_ADS_OPTIMIZATION_STRATEGY.md`](../META_ADS_OPTIMIZATION_STRATEGY.md)
