# API Endpoint Examples

This directory contains **reference implementations** of Next.js API routes that demonstrate how to use the database models from this repository in a real Next.js application.

## ⚠️ Important Context

This repository is a **database layer only** - it provides MongoDB models, Redis utilities, and middleware for a Meta ads optimization SaaS. These example API routes show you **how to consume** these models in your Next.js app, but they are **not meant to run in this repo**.

The TypeScript errors you see (e.g., `Cannot find module 'next/server'`) are **expected** - these files are templates for your actual Next.js application.

## Architecture Overview

```
┌─────────────────────────────────────────────────┐
│ Next.js App (your separate application)        │
│  ├─ app/api/campaigns/[id]/ad-sets/route.ts   │
│  ├─ app/api/ad-sets/[id]/ads/route.ts         │
│  └─ app/api/ads/[id]/route.ts                 │
│                                                 │
│  Imports models and utilities from:            │
└────────────────┬────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────┐
│ THIS REPO: Database Layer (installed via npm)  │
│  ├─ lib/db/models/campaign.ts                  │
│  ├─ lib/db/models/ad-set.ts                    │
│  ├─ lib/db/models/ad.ts                        │
│  ├─ lib/middleware/rate-limit.ts               │
│  ├─ lib/middleware/auth.ts                     │
│  └─ lib/utils/validators.ts                    │
└────────────────┬────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────┐
│ MongoDB 6 + Redis 7 (Docker or cloud)          │
└─────────────────────────────────────────────────┘
```

## Available API Examples

### 1. Campaign Ad Sets (`examples/api/campaigns/[id]/ad-sets/route.ts`)

**POST /api/campaigns/:id/ad-sets**
- Create a new ad set under a campaign
- Validates targeting, budget, and bid strategy
- Automatically sets learning phase to `LEARNING` on creation
- Returns created ad set with all fields

**GET /api/campaigns/:id/ad-sets**
- List all ad sets for a campaign
- Supports filtering by status and learning phase
- Pagination with configurable page size
- Sorting by any field (default: `createdAt` desc)

**Key Features:**
- ✅ Authentication check (Bearer token)
- ✅ Rate limiting by tenant
- ✅ Zod validation for request bodies
- ✅ Campaign ownership verification
- ✅ Structured error responses
- ✅ Comprehensive logging

### 2. Ad Set Ads (`examples/api/ad-sets/[id]/ads/route.ts`)

**POST /api/ad-sets/:id/ads**
- Create a new ad under an ad set
- Validates creative fields (headline, body, CTA, etc.)
- Starts as `DRAFT` status by default
- Links to parent ad set and campaign

**GET /api/ad-sets/:id/ads**
- List all ads in an ad set
- Filter by `status` and `effectiveStatus`
- Pagination and sorting support
- Returns creative data and issues

**Key Features:**
- ✅ Ad set ownership verification
- ✅ Creative validation
- ✅ Issue tracking support
- ✅ Pagination metadata (total, pages, hasNext/hasPrev)

### 3. Ad Management (`examples/api/ads/[id]/route.ts`)

**GET /api/ads/:id**
- Retrieve a single ad by ID
- Returns full ad details including creative and issues
- Ownership verification via `accountId` tenant check

**PATCH /api/ads/:id**
- Update ad name, status, creative, or effective status
- Business logic: Prevents activation if creative incomplete
- Business logic: Prevents activation if active ERROR-level issues exist
- Merges creative updates with existing data

**DELETE /api/ads/:id**
- Soft delete: Sets `status` to `DELETED`
- Also updates `effectiveStatus` to `DELETED`
- Does not remove from database (preserves history)

**Key Features:**
- ✅ Partial updates (PATCH semantics)
- ✅ Business rule validation
- ✅ Soft delete pattern
- ✅ Creative merge logic
- ✅ Issue-aware activation checks

## How to Use These Examples in Your Next.js App

### Step 1: Install This Database Layer

In your Next.js project:

```bash
npm install git+https://github.com/your-org/meta-ad.git
# OR if published to npm:
npm install @your-org/meta-ad-db
```

### Step 2: Set Up Environment Variables

Create `.env.local` in your Next.js app:

```bash
# MongoDB connection
MONGODB_URI=mongodb://localhost:27017/meta-ads-optimization

# Redis connection
REDIS_URL=redis://localhost:6379

# Encryption key for Meta tokens (64 hex characters)
ENCRYPTION_KEY=your-64-character-hex-key-here

# JWT secret for NextAuth
NEXTAUTH_SECRET=your-nextauth-secret-here

# Meta OAuth credentials
META_APP_ID=your-meta-app-id
META_APP_SECRET=your-meta-app-secret
```

### Step 3: Copy Example Routes to Your App

```bash
# In your Next.js 15+ app with App Router:
cp examples/api/campaigns/[id]/ad-sets/route.ts app/api/campaigns/[id]/ad-sets/route.ts
cp examples/api/ad-sets/[id]/ads/route.ts app/api/ad-sets/[id]/ads/route.ts
cp examples/api/ads/[id]/route.ts app/api/ads/[id]/route.ts
```

### Step 4: Update Import Paths

Change the import paths from relative to your installed package:

```typescript
// Before (example imports):
import { initializeDatabase } from '../../../../lib/db';
import { CampaignModel, AdSetModel } from '../../../../lib/db/models';

// After (actual imports):
import { initializeDatabase } from '@your-org/meta-ad-db/lib/db';
import { CampaignModel, AdSetModel } from '@your-org/meta-ad-db/lib/db/models';
```

### Step 5: Implement Real Authentication

The examples use a simplified auth pattern. Replace with your actual auth:

```typescript
// Example uses:
const authHeader = request.headers.get('authorization');
if (!authHeader?.startsWith('Bearer ')) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
const user = { tenantId: 'tenant-123' }; // Hardcoded

// Real implementation with NextAuth:
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

const session = await getServerSession(authOptions);
if (!session?.user) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

const user = {
  userId: session.user.id,
  tenantId: session.user.tenantId, // From your user model
};
```

### Step 6: Test Your API Routes

```bash
# Start your Next.js dev server:
npm run dev

# Test with curl:
curl -X POST http://localhost:3000/api/campaigns/camp_123/ad-sets \
  -H "Authorization: Bearer your-jwt-token" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Ad Set",
    "targeting": { "countries": ["US"], "ageMin": 18, "ageMax": 65 },
    "dailyBudget": 50.00,
    "bidStrategy": "LOWEST_COST_WITHOUT_CAP"
  }'
```

## Common Patterns Demonstrated

### 1. Authentication + Rate Limiting
```typescript
// Every protected route should:
const authHeader = request.headers.get('authorization');
if (!authHeader?.startsWith('Bearer ')) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

const rateLimitResult = await rateLimitByTenant(request, user.tenantId);
if (!rateLimitResult.allowed) {
  return NextResponse.json(
    { error: 'Rate limit exceeded', retryAfter: rateLimitResult.retryAfter },
    { status: 429, headers: { 'Retry-After': rateLimitResult.retryAfter!.toString() } }
  );
}
```

### 2. Request Validation with Zod
```typescript
import { z } from 'zod';

const createAdSetSchema = z.object({
  name: z.string().min(1).max(255),
  dailyBudget: z.number().positive().max(100000),
  targeting: z.object({
    countries: z.array(z.string()).min(1),
    ageMin: z.number().int().min(13).max(65).optional(),
    ageMax: z.number().int().min(13).max(65).optional(),
  }),
});

const body = await request.json();
const validatedData = createAdSetSchema.parse(body);
// Use validatedData (typed correctly!)
```

### 3. Ownership Verification
```typescript
// Always verify the user owns the resource via accountId:
const campaign = await CampaignModel.findOne({
  campaignId,
  accountId: { $regex: new RegExp(`^act_.*${user.tenantId}`) },
});

if (!campaign) {
  return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
}
```

### 4. Pagination Pattern
```typescript
const page = parseInt(searchParams.get('page') || '1', 10);
const limit = parseInt(searchParams.get('limit') || '20', 10);
const skip = (page - 1) * limit;

const [items, total] = await Promise.all([
  Model.find(query).skip(skip).limit(limit).sort({ createdAt: -1 }).lean(),
  Model.countDocuments(query),
]);

const totalPages = Math.ceil(total / limit);
return NextResponse.json({
  data: items,
  meta: {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  },
});
```

### 5. Error Handling
```typescript
try {
  // Your logic
} catch (error) {
  logger.error('Operation failed', { error, context });

  if (error instanceof z.ZodError) {
    return NextResponse.json(
      { error: 'Validation error', code: 'VALIDATION_ERROR', details: error.errors },
      { status: 400 }
    );
  }

  return NextResponse.json(
    { error: 'Internal server error', code: 'INTERNAL_ERROR' },
    { status: 500 }
  );
}
```

## Business Logic Examples

### Ad Activation Validation
```typescript
// From PATCH /api/ads/:id
if (validatedData.status === 'ACTIVE') {
  // Check creative completeness
  if (!ad.creative?.headline || !ad.creative?.body) {
    return NextResponse.json(
      { error: 'Cannot activate ad without complete creative', code: 'INVALID_OPERATION' },
      { status: 400 }
    );
  }

  // Check for active ERROR-level issues
  const activeIssues = ad.issues?.filter((issue) => issue.level === 'ERROR') || [];
  if (activeIssues.length > 0) {
    return NextResponse.json(
      {
        error: 'Cannot activate ad with active issues',
        code: 'INVALID_OPERATION',
        details: { issues: activeIssues.map((i) => ({ code: i.errorCode })) },
      },
      { status: 400 }
    );
  }
}
```

### Learning Phase Management
```typescript
// From POST /api/campaigns/:id/ad-sets
const adSet = await AdSetModel.create({
  adSetId,
  campaignId: campaign.campaignId,
  accountId: campaign.accountId,
  name: validatedData.name,
  status: 'ACTIVE',
  targeting: validatedData.targeting,
  dailyBudget: validatedData.dailyBudget,
  bidStrategy: validatedData.bidStrategy,
  learningPhaseStatus: 'LEARNING', // Always start in learning phase
});
```

## Testing Your Integration

### 1. Unit Tests
Test your API routes using Next.js testing utilities:

```typescript
import { GET, POST } from '@/app/api/campaigns/[id]/ad-sets/route';
import { NextRequest } from 'next/server';

describe('POST /api/campaigns/:id/ad-sets', () => {
  it('creates an ad set with valid data', async () => {
    const request = new NextRequest('http://localhost/api/campaigns/camp_123/ad-sets', {
      method: 'POST',
      headers: { 'authorization': 'Bearer valid-token' },
      body: JSON.stringify({ name: 'Test', dailyBudget: 50, targeting: {} }),
    });

    const response = await POST(request, { params: { id: 'camp_123' } });
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.data.adSetId).toBeDefined();
  });
});
```

### 2. Integration Tests
Use the database layer's test utilities:

```bash
# In this repo, run:
npm run test:db       # Test database initialization
npm run test:models   # Test AdSet and Ad models
npm run test:auth     # Test authentication middleware
npm run test:rate     # Test rate limiting
```

## Security Considerations

1. **Never expose sensitive data**: The examples redact internal fields. Maintain this pattern.
2. **Always verify ownership**: Check `accountId` contains tenant ID before operations.
3. **Rate limit everything**: Use `rateLimitByTenant()` on all mutating operations.
4. **Validate all inputs**: Use Zod schemas for type safety and runtime validation.
5. **Log security events**: Use `logger` to track auth failures, rate limit hits, etc.
6. **Encrypt tokens at rest**: Meta tokens are automatically encrypted by the model layer.

## Next Steps

### Option A: Build the Full Next.js Application
1. Set up Next.js 15+ with App Router
2. Install this database layer package
3. Copy and adapt these API examples
4. Implement real authentication (NextAuth.js)
5. Add frontend components to consume these APIs

### Option B: Add Meta API Integration
1. Create sync services to pull data from Meta API
2. Use `MetaConnection` model to manage OAuth tokens
3. Implement webhook handlers for real-time updates
4. Add background jobs for periodic syncing

### Option C: Build Optimization Engine
1. Implement the strategy from `META_ADS_OPTIMIZATION_STRATEGY.md`
2. Create optimization recommendation engine
3. Add performance tracking and alerting
4. Build ML models for bid optimization

## Questions?

Refer to the main repository documentation:
- **Architecture**: `README.md`
- **Setup**: `CONTRIBUTING.md`
- **Strategy**: `META_ADS_OPTIMIZATION_STRATEGY.md`
- **AI Agent Guide**: `.github/copilot-instructions.md`

---

**Remember**: These are **reference implementations** to guide your Next.js development. Adapt them to your specific authentication, error handling, and business logic requirements.
