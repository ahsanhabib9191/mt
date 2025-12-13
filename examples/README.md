# Meta Ads API - Example Implementations

This directory contains complete, production-ready example implementations for building a Meta/Facebook Ads management system.

## 📁 Directory Structure

```
examples/
└── api/                    # Next.js API Routes
    ├── auth/              # OAuth authentication
    │   ├── facebook.ts           # OAuth initiation
    │   └── callback/
    │       └── facebook.ts       # OAuth callback handler
    ├── campaigns/         # Campaign management
    │   ├── index.ts              # List & create campaigns
    │   └── [id].ts               # Get, update, archive campaign
    ├── ads/               # Ad management
    │   ├── index.ts              # List & create ads
    │   └── [id].ts               # Get, update, delete ad
    └── insights/          # Performance analytics
        └── index.ts              # Get insights with breakdowns
```

## 🚀 Quick Start

### 1. Prerequisites

Ensure you have completed the following:

- ✅ Meta App created (see `docs/META_API_SETUP.md`)
- ✅ Environment variables configured (`.env`)
- ✅ MongoDB and Redis running (`npm run docker:up`)
- ✅ Database initialized (`npm run test:db`)

### 2. Copy to Your Next.js Project

**For Pages Router:**
```bash
cp -r examples/api/* pages/api/
```

**For App Router:**
```bash
cp -r examples/api/* app/api/
```

### 3. Install Dependencies

These examples use the database library:

```bash
npm install
```

### 4. Test OAuth Flow

1. Start your Next.js app:
   ```bash
   npm run dev
   ```

2. Visit: `http://localhost:3000/api/auth/facebook`

3. Grant permissions on Facebook

4. You'll be redirected to: `http://localhost:3000/api/auth/callback/facebook?code=...`

5. Check logs for successful token storage

### 5. Test API Endpoints

Use curl, Postman, or your frontend:

```bash
# List campaigns
curl "http://localhost:3000/api/campaigns?adAccountId=act_123456&tenant=your-tenant-id"

# Create campaign
curl -X POST "http://localhost:3000/api/campaigns?adAccountId=act_123456&tenant=your-tenant-id" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Campaign",
    "objective": "OUTCOME_SALES",
    "dailyBudget": 50,
    "status": "PAUSED"
  }'

# Get insights
curl "http://localhost:3000/api/insights?objectId=120210000000000&level=campaign&datePreset=last_7d&tenant=your-tenant-id"
```

## 📚 API Documentation

See [`docs/API_ROUTES_REFERENCE.md`](../docs/API_ROUTES_REFERENCE.md) for complete API documentation.

## 🔐 Authentication Flow

### OAuth 2.0 Implementation

The OAuth flow is implemented across two endpoints:

**1. Initiation (`/api/auth/facebook`)**
- Generates authorization URL with required scopes
- Creates CSRF token for security
- Stores state in secure cookie
- Redirects user to Facebook

**2. Callback (`/api/auth/callback/facebook`)**
- Validates CSRF state token
- Exchanges authorization code for access token
- Exchanges short-lived token for long-lived token (60 days)
- Fetches user info and ad accounts
- Stores encrypted token in database
- Redirects to dashboard

### Security Features

- ✅ **CSRF Protection**: State parameter validates callback
- ✅ **Token Encryption**: AES-256-GCM encryption at rest
- ✅ **Secure Cookies**: HttpOnly, Secure, SameSite=Lax
- ✅ **Token Expiration**: Automatically tracks expiry
- ✅ **Error Handling**: Comprehensive error logging

## 🎯 Campaign Management

### Create Campaign

```typescript
POST /api/campaigns?adAccountId=act_123&tenant=my-tenant

{
  "name": "Holiday Sale 2025",
  "objective": "OUTCOME_SALES",
  "status": "PAUSED",
  "dailyBudget": 100,
  "specialAdCategories": ["EMPLOYMENT"]
}
```

**Features:**
- ✅ Validation with Zod schemas
- ✅ Budget conversion (dollars → cents)
- ✅ Database synchronization
- ✅ Support for daily/lifetime budgets
- ✅ Special ad category compliance

### List Campaigns

```typescript
GET /api/campaigns?adAccountId=act_123&tenant=my-tenant&status=ACTIVE&limit=25&page=1
```

**Features:**
- ✅ Filtering by status
- ✅ Pagination support
- ✅ Background database sync
- ✅ Comprehensive campaign details

### Update Campaign

```typescript
PATCH /api/campaigns/120210000000000?adAccountId=act_123&tenant=my-tenant

{
  "name": "Updated Campaign Name",
  "status": "ACTIVE",
  "dailyBudget": 150
}
```

**Features:**
- ✅ Partial updates supported
- ✅ Budget updates with validation
- ✅ Status changes
- ✅ Database synchronization

### Archive Campaign

```typescript
DELETE /api/campaigns/120210000000000?adAccountId=act_123&tenant=my-tenant
```

**Note:** Campaigns cannot be deleted via Meta API, only archived (status = ARCHIVED).

## 🎨 Ad Management

### Create Ad (with Creative)

```typescript
POST /api/ads?adAccountId=act_123&tenant=my-tenant

{
  "adsetId": "120210000000003",
  "name": "Holiday Ad 1",
  "status": "PAUSED",
  "creative": {
    "name": "Holiday Creative",
    "objectStorySpec": {
      "pageId": "123456789",
      "linkData": {
        "message": "Shop our holiday sale!",
        "link": "https://example.com/sale",
        "name": "50% Off Everything",
        "imageHash": "abc123hash",
        "callToAction": {
          "type": "SHOP_NOW",
          "value": {
            "link": "https://example.com/sale"
          }
        }
      }
    }
  }
}
```

**Features:**
- ✅ Two-step creation (creative + ad)
- ✅ Support for all call-to-action types
- ✅ Link ads with images
- ✅ Database storage
- ✅ Comprehensive validation

### List Ads

```typescript
GET /api/ads?adAccountId=act_123&tenant=my-tenant&campaignId=120210000000000&status=ACTIVE&limit=25
```

**Features:**
- ✅ Filter by campaign/ad set
- ✅ Filter by status
- ✅ Includes creative details
- ✅ Effective status tracking

### Update & Delete Ads

```typescript
PATCH /api/ads/[id]?adAccountId=act_123&tenant=my-tenant
DELETE /api/ads/[id]?adAccountId=act_123&tenant=my-tenant
```

**Features:**
- ✅ Update name or status
- ✅ Delete (archive) ads
- ✅ Database synchronization

## 📊 Performance Insights

### Get Insights with Breakdowns

```typescript
GET /api/insights?objectId=120210000000000&level=campaign&datePreset=last_7d&breakdowns=age,gender&tenant=my-tenant
```

**Available Metrics:**
- **Delivery**: impressions, reach, frequency
- **Engagement**: clicks, CTR
- **Cost**: spend, CPC, CPM, CPP
- **Conversions**: actions, action values, cost per action
- **Video**: watch time, completion rates

**Date Presets:**
- `today`, `yesterday`
- `last_7d`, `last_14d`, `last_30d`, `last_90d`
- `this_week`, `last_week`
- `this_month`, `last_month`
- `lifetime`

**Breakdowns:**
- Demographics: `age`, `gender`
- Location: `country`, `region`, `dma`
- Placement: `placement`, `device_platform`, `publisher_platform`

**Response Features:**
- ✅ Detailed insights per breakdown
- ✅ Aggregated totals across all data
- ✅ Normalized action format
- ✅ Video metrics (when applicable)
- ✅ Custom date ranges support

## 🔧 Customization Guide

### Adding Authentication Middleware

Wrap endpoints with authentication:

```typescript
import { authenticate } from '@/lib/middleware/auth';

export default authenticate(async (req, res) => {
  // Your handler code
});
```

### Adding Rate Limiting

```typescript
import { rateLimit } from '@/lib/middleware/rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});

export default limiter(async (req, res) => {
  // Your handler code
});
```

### Caching Responses

Use Redis for caching:

```typescript
import { redis } from '@/lib/db/redis';

const cacheKey = `campaigns:${adAccountId}:${status}`;
const cached = await redis.get(cacheKey);

if (cached) {
  return res.json(JSON.parse(cached));
}

// Fetch from API
const campaigns = await fetchCampaigns();

// Cache for 5 minutes
await redis.setex(cacheKey, 300, JSON.stringify(campaigns));

return res.json(campaigns);
```

### Error Monitoring

Add error tracking:

```typescript
import { logger } from '@/lib/utils/logger';

try {
  // API operations
} catch (error) {
  logger.error('Campaign creation failed', {
    error: error.message,
    tenantId,
    adAccountId,
    stack: error.stack,
  });
  
  // Send to monitoring service (Sentry, etc.)
  throw error;
}
```

## 🧪 Testing

### Test Scripts Included

```bash
# Test OAuth configuration
npm run test:oauth

# Test Meta API connection
npm run test:meta

# Test authentication middleware
npm run test:auth

# Test rate limiting
npm run test:rate
```

### Manual Testing Checklist

- [ ] OAuth flow completes successfully
- [ ] Tokens are encrypted in database
- [ ] Campaign creation works
- [ ] Campaign listing with filters works
- [ ] Campaign update works
- [ ] Campaign archiving works
- [ ] Ad creation with creative works
- [ ] Ad listing with filters works
- [ ] Insights fetch with breakdowns works
- [ ] Error handling works (try invalid data)
- [ ] Rate limiting activates (make rapid requests)

## 🚨 Common Issues

### "Tenant not found"
- Ensure tenantId is passed via query or header
- Check database for tenant record
- Run `npm run test:db` to verify connection

### "Meta connection not found"
- Complete OAuth flow first
- Check `metaConnections` collection in MongoDB
- Verify tenant has active Meta connection

### "Token expired"
- Long-lived tokens expire after 60 days
- Implement token refresh logic
- Redirect user to OAuth flow

### "Rate limit exceeded"
- Meta API limits: 200 calls/hour/user
- Implement caching for frequent requests
- Use batch requests when possible

### "Invalid OAuth state"
- CSRF token mismatch
- Cookie may have expired (1 hour TTL)
- Restart OAuth flow

## 📖 Additional Resources

- [Complete API Reference](../docs/API_ROUTES_REFERENCE.md)
- [Meta API Setup Guide](../docs/META_API_SETUP.md)
- [Meta Marketing API Docs](https://developers.facebook.com/docs/marketing-apis)
- [OAuth Best Practices](https://datatracker.ietf.org/doc/html/rfc6749)

## 💡 Next Steps

1. **Copy routes to your app** (`pages/api/` or `app/api/`)
2. **Add authentication middleware** for production
3. **Implement rate limiting** per endpoint
4. **Add caching layer** (Redis) for performance
5. **Build frontend UI** to consume APIs
6. **Set up monitoring** (logging, error tracking)
7. **Add unit tests** for business logic
8. **Configure CI/CD** for deployments

## 🤝 Contributing

Found an issue or want to improve these examples? See [CONTRIBUTING.md](../CONTRIBUTING.md).

## 📄 License

This project is licensed under the MIT License.
