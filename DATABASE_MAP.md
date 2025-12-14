# 🗺️ Giant Tech Database Map

> How the MongoDB layer is organized so the "Invisible Friend" can reason like a Giant Tech stack.

## Storage Stack
- **MongoDB**: Source of truth for campaigns, assets, analytics, and audit trails.
- **Redis**: Rate limiting, queues, session/cache data (prefixed keys like `ratelimit:`, `queue:`, `session:`).

## Core Collections

### Access & Identity
- **Tenant** (`lib/db/models/Tenant.ts`): Multi-tenant profile, plan, and hashed API keys. Indexes: `tenantId` (unique), `primaryDomain` (sparse), `apiKeyHash` (sparse).
- **MetaConnection** (`lib/db/models/MetaConnection.ts`): Encrypted OAuth tokens per tenant + ad account, stored with status, permissions, and page metadata. Indexes: `(tenantId, adAccountId)` unique, `status`, `tokenExpiresAt`.
- **AdAccount** (`lib/db/models/ad-account.ts`): Meta ad account metadata (name, currency, status, spending limits). Indexes: `accountId` (unique), `status`, `businessId` (sparse). Linked to tenants through `MetaConnection`.

### Campaign Graph
- **Campaign** (`lib/db/models/campaign.ts`): Campaign definition with objective, budget, and dates. Indexes: `campaignId` unique, `(accountId, status)`, `objective`.
- **AdSet** (`lib/db/models/ad-set.ts`): Targeting + budget for each campaign. Indexes: `adSetId` unique, `(campaignId, status)`, `(accountId, status)`, `status`, `learningPhaseStatus`, `(status, learningPhaseStatus)`.
- **Ad** (`lib/db/models/ad.ts`): Creative payload, policy issues, effective status. Indexes: `adId` unique, `(adSetId, status)`, `(campaignId, status)`, `(accountId, status)`, `effectiveStatus`, `creative.creativeId`.

### Analytics & Optimization
- **PerformanceSnapshot** (`lib/db/models/performance-snapshot.ts`): Daily metrics per entity (`entityType`, `entityId`, `date` unique) with spend/ROAS breakdowns. Indexes: `(entityType, entityId, date)` unique, `date`.
- **AudienceInsight** (`lib/db/models/audience-insight.ts`): Dimension-level breakdowns (age, gender, geo, placement). Indexes: `(entityType, entityId, dimension, value, date)` unique, `date`.
- **OptimizationLog** (`lib/db/models/optimization-log.ts`): Audit log of every action the optimizer takes. Indexes: `(entityType, entityId, executedAt)`, `accountId`, `ruleId`, `(success, executedAt)`.

### Creative, Content & Quality
- **CreativeAsset** (`lib/db/models/creative-asset.ts`): Stored images/videos with Meta hashes. Indexes: `assetId` unique, `tenantId`, `accountId`, `(accountId, originalUrl)`.
- **GeneratedCopy** (`lib/db/models/GeneratedCopy.ts`): AI-written copy with usage references. Indexes: `(tenantId, context, createdAt)`, `tags`.
- **BoostDraft** (`lib/db/models/BoostDraft.ts`): One draft per session for quick-boost flows (selected creative, targeting, budget). Indexes: `sessionId` unique, `tenantId`, `status`.
- **WebsiteAudit** (`lib/db/models/WebsiteAudit.ts`): Site-quality reports with issues/metrics. Indexes: `(tenantId, url)` unique, `status`, `lastRunAt`.

## Relationship Map
```
Tenant
 ├─ MetaConnection ──> AdAccount
 ├─ Campaign ──> AdSet ──> Ad
 │      ├─ PerformanceSnapshot (entityType/entityId)
 │      └─ AudienceInsight (entityType/entityId)
 ├─ OptimizationLog (entityType/entityId)
 ├─ CreativeAsset (accountId/tenantId)
 ├─ GeneratedCopy (usedBy → CAMPAIGN/AD_SET/AD)
 ├─ BoostDraft (session scoped drafts)
 └─ WebsiteAudit (tenant + url)
```

## Giant Tech Notes
- **Tenant Isolation:** Every collection carries `tenantId` or `accountId` for clean separation.
- **Encrypted Secrets:** OAuth tokens are encrypted at rest in `MetaConnection`; API keys are hashed in `Tenant`.
- **Query Performance:** Compound indexes mirror common filters (by status, date, or parent entity) to keep dashboards and workers fast.
- **Auditability:** OptimizationLog + PerformanceSnapshot provide a full trail of what changed and why.
