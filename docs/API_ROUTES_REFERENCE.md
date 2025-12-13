# Next.js API Routes - Complete Reference

Complete set of API routes for managing Meta/Facebook ad campaigns, ad sets, ads, and performance insights.

## Table of Contents

1. [Authentication](#authentication)
2. [Campaigns API](#campaigns-api)
3. [Ads API](#ads-api)
4. [Insights API](#insights-api)
5. [Request/Response Format](#requestresponse-format)
6. [Error Handling](#error-handling)
7. [Rate Limiting](#rate-limiting)
8. [Examples](#examples)

---

## Authentication

All API endpoints require authentication via tenant ID.

### Methods:

**Option 1: Query Parameter**
```
GET /api/campaigns?tenant=your-tenant-id
```

**Option 2: Header**
```
X-Tenant-ID: your-tenant-id
```

### OAuth Flow

Before using these APIs, users must complete OAuth:

1. **Initiate OAuth**: `GET /api/auth/facebook`
2. **Handle Callback**: `GET /api/auth/callback/facebook`
3. **Token Stored**: Encrypted in database
4. **Use APIs**: Access token automatically retrieved

---

## Campaigns API

Manage Meta ad campaigns.

### List Campaigns

```http
GET /api/campaigns?adAccountId={id}&tenant={tenantId}
```

**Query Parameters:**
- `adAccountId` (required) - Meta ad account ID
- `tenant` (required) - Your tenant ID
- `status` (optional) - Filter by status: `ACTIVE`, `PAUSED`, `ARCHIVED`
- `limit` (optional) - Results per page (1-100, default: 25)
- `page` (optional) - Page number (default: 1)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "120210000000000",
      "name": "Summer Sale Campaign",
      "status": "ACTIVE",
      "objective": "OUTCOME_SALES",
      "dailyBudget": 50.00,
      "lifetimeBudget": null,
      "startTime": "2025-01-01T00:00:00+0000",
      "stopTime": null,
      "createdTime": "2024-12-01T10:30:00+0000",
      "updatedTime": "2024-12-10T14:20:00+0000"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 25,
    "total": 15
  }
}
```

### Create Campaign

```http
POST /api/campaigns?adAccountId={id}&tenant={tenantId}
```

**Request Body:**
```json
{
  "name": "New Campaign",
  "objective": "OUTCOME_SALES",
  "status": "PAUSED",
  "dailyBudget": 50.00,
  "specialAdCategories": ["EMPLOYMENT", "HOUSING"]
}
```

**Campaign Objectives:**
- `OUTCOME_AWARENESS` - Brand awareness
- `OUTCOME_ENGAGEMENT` - Post engagement
- `OUTCOME_LEADS` - Lead generation
- `OUTCOME_SALES` - Conversions/purchases
- `OUTCOME_TRAFFIC` - Website traffic
- `OUTCOME_APP_PROMOTION` - App installs

**Budget Rules:**
- Must specify `dailyBudget` OR `lifetimeBudget` (not both)
- Values in dollars (will be converted to cents for Meta API)
- Minimum: $1.00

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "120210000000001",
    "name": "New Campaign",
    "status": "PAUSED",
    "objective": "OUTCOME_SALES",
    "dailyBudget": 50.00,
    "createdTime": "2025-12-10T15:00:00+0000"
  }
}
```

### Get Campaign

```http
GET /api/campaigns/[id]?tenant={tenantId}&adAccountId={id}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "120210000000000",
    "name": "Summer Sale Campaign",
    "status": "ACTIVE",
    "objective": "OUTCOME_SALES",
    "dailyBudget": 50.00,
    "budgetRemaining": 1250.50,
    "startTime": "2025-01-01T00:00:00+0000",
    "stopTime": null,
    "createdTime": "2024-12-01T10:30:00+0000",
    "updatedTime": "2024-12-10T14:20:00+0000"
  }
}
```

### Update Campaign

```http
PATCH /api/campaigns/[id]?tenant={tenantId}&adAccountId={id}
```

**Request Body:**
```json
{
  "name": "Updated Campaign Name",
  "status": "ACTIVE",
  "dailyBudget": 75.00
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "120210000000000",
    "success": true
  }
}
```

### Archive Campaign

```http
DELETE /api/campaigns/[id]?tenant={tenantId}&adAccountId={id}
```

**Note:** Campaigns cannot be truly deleted, only archived.

**Response:**
```json
{
  "success": true,
  "message": "Campaign archived successfully"
}
```

---

## Ads API

Manage individual ads.

### List Ads

```http
GET /api/ads?adAccountId={id}&tenant={tenantId}
```

**Query Parameters:**
- `adAccountId` (required) - Meta ad account ID
- `tenant` (required) - Your tenant ID
- `adsetId` (optional) - Filter by ad set
- `campaignId` (optional) - Filter by campaign
- `status` (optional) - Filter by status: `ACTIVE`, `PAUSED`, `ARCHIVED`
- `limit` (optional) - Results per page (1-100, default: 25)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "120210000000002",
      "name": "Ad Creative 1",
      "status": "ACTIVE",
      "effectiveStatus": "ACTIVE",
      "adsetId": "120210000000003",
      "campaignId": "120210000000000",
      "creative": {
        "id": "120210000000004",
        "name": "Summer Sale Creative"
      },
      "createdTime": "2025-01-05T10:00:00+0000",
      "updatedTime": "2025-01-10T14:30:00+0000"
    }
  ],
  "pagination": {
    "total": 10,
    "limit": 25
  }
}
```

### Create Ad

```http
POST /api/ads?adAccountId={id}&tenant={tenantId}
```

**Request Body:**
```json
{
  "adsetId": "120210000000003",
  "name": "New Ad",
  "status": "PAUSED",
  "creative": {
    "name": "Holiday Sale Creative",
    "objectStorySpec": {
      "pageId": "123456789",
      "linkData": {
        "message": "Check out our holiday sale!",
        "link": "https://example.com/sale",
        "caption": "example.com",
        "description": "Up to 50% off everything",
        "name": "Shop Holiday Sale",
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

**Call-to-Action Types:**
- `LEARN_MORE`
- `SHOP_NOW`
- `SIGN_UP`
- `BOOK_TRAVEL`
- `CONTACT_US`
- `DOWNLOAD`
- `GET_QUOTE`
- `APPLY_NOW`
- `SUBSCRIBE`

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "120210000000005",
    "name": "New Ad",
    "status": "PAUSED",
    "adsetId": "120210000000003",
    "creativeId": "120210000000006"
  }
}
```

### Get Ad

```http
GET /api/ads/[id]?tenant={tenantId}&adAccountId={id}
```

### Update Ad

```http
PATCH /api/ads/[id]?tenant={tenantId}&adAccountId={id}
```

**Request Body:**
```json
{
  "name": "Updated Ad Name",
  "status": "ACTIVE"
}
```

### Delete Ad

```http
DELETE /api/ads/[id]?tenant={tenantId}&adAccountId={id}
```

**Note:** Ads are archived, not deleted.

---

## Insights API

Get performance metrics and analytics.

### Get Insights

```http
GET /api/insights?objectId={id}&tenant={tenantId}&adAccountId={id}
```

**Query Parameters:**
- `objectId` (required) - Campaign, Ad Set, or Ad ID
- `tenant` (required) - Your tenant ID
- `adAccountId` (optional) - Meta ad account ID
- `level` (optional) - `campaign`, `adset`, `ad` (default: campaign)
- `datePreset` (optional) - Time range preset (see below)
- `timeRange` (optional) - Custom date range (see below)
- `breakdowns` (optional) - Breakdown dimensions (see below)

**Date Presets:**
- `today` - Today's data
- `yesterday` - Yesterday's data
- `last_7d` - Last 7 days
- `last_14d` - Last 14 days
- `last_30d` - Last 30 days
- `last_90d` - Last 90 days
- `this_week` - Current week (Mon-Sun)
- `last_week` - Previous week
- `this_month` - Current month
- `last_month` - Previous month
- `lifetime` - All time

**Custom Time Range:**
```json
{
  "timeRange": {
    "since": "2025-01-01",
    "until": "2025-01-31"
  }
}
```

**Breakdown Dimensions:**
- `age` - Age groups (18-24, 25-34, etc.)
- `gender` - Male, Female, Unknown
- `country` - Country codes
- `region` - Regions within countries
- `dma` - Designated Market Areas (US)
- `placement` - Ad placements (Feed, Stories, etc.)
- `device_platform` - Mobile, Desktop, etc.
- `publisher_platform` - Facebook, Instagram, etc.

**Example Request:**
```http
GET /api/insights?objectId=120210000000000&level=campaign&datePreset=last_7d&breakdowns=age,gender&tenant=my-tenant
```

**Response:**
```json
{
  "success": true,
  "data": {
    "insights": [
      {
        "dateStart": "2025-12-03",
        "dateStop": "2025-12-09",
        
        "impressions": 45230,
        "reach": 32150,
        "frequency": 1.41,
        
        "clicks": 1250,
        "ctr": 2.76,
        
        "spend": 485.50,
        "cpc": 0.39,
        "cpm": 10.73,
        "cpp": 15.11,
        "costPerUniqueClick": 0.45,
        
        "actions": {
          "link_click": 980,
          "post_engagement": 1450,
          "purchase": 45,
          "add_to_cart": 120
        },
        
        "actionValues": {
          "purchase": 2250.00
        },
        
        "conversions": {
          "purchase": 45
        },
        
        "conversionValues": {
          "purchase": 2250.00
        },
        
        "costPerAction": {
          "link_click": 0.50,
          "purchase": 10.79
        },
        
        "videoMetrics": {
          "avgTimeWatched": {},
          "p25Watched": {},
          "p50Watched": {},
          "p75Watched": {},
          "p100Watched": {}
        },
        
        "breakdowns": {
          "age": "25-34",
          "gender": "female"
        }
      }
    ],
    
    "aggregated": {
      "impressions": 45230,
      "reach": 32150,
      "clicks": 1250,
      "spend": 485.50,
      "frequency": 1.41,
      "ctr": 2.76,
      "cpc": 0.39,
      "cpm": 10.73
    },
    
    "metadata": {
      "objectId": "120210000000000",
      "level": "campaign",
      "datePreset": "last_7d",
      "breakdowns": ["age", "gender"]
    }
  }
}
```

**Metrics Explained:**

**Delivery:**
- `impressions` - Times ad was shown
- `reach` - Unique users who saw ad
- `frequency` - Average times each user saw ad

**Engagement:**
- `clicks` - Total clicks
- `ctr` - Click-through rate (%)

**Cost:**
- `spend` - Total amount spent
- `cpc` - Cost per click
- `cpm` - Cost per 1000 impressions
- `cpp` - Cost per 1000 reached users

**Conversions:**
- `actions` - Actions taken (clicks, purchases, etc.)
- `actionValues` - Value of actions (purchase amounts)
- `conversions` - Conversion events
- `conversionValues` - Value of conversions
- `costPerAction` - Cost per action type

---

## Request/Response Format

### Standard Success Response

```json
{
  "success": true,
  "data": { /* response data */ }
}
```

### Standard Error Response

```json
{
  "error": "Error type",
  "message": "Human-readable error message",
  "details": { /* additional error details */ }
}
```

### HTTP Status Codes

- `200 OK` - Success
- `201 Created` - Resource created
- `400 Bad Request` - Validation error
- `401 Unauthorized` - Missing/invalid authentication
- `404 Not Found` - Resource not found
- `405 Method Not Allowed` - HTTP method not supported
- `500 Internal Server Error` - Server error

---

## Error Handling

### Validation Errors

```json
{
  "error": "Validation error",
  "details": [
    {
      "code": "invalid_type",
      "expected": "string",
      "received": "number",
      "path": ["name"],
      "message": "Expected string, received number"
    }
  ]
}
```

### Meta API Errors

```json
{
  "error": "Failed to create campaign",
  "details": {
    "error": {
      "message": "(#100) daily_budget must be at least 1.00 USD",
      "type": "OAuthException",
      "code": 100,
      "fbtrace_id": "AaBbCcDdEeFfGg"
    }
  }
}
```

### Common Meta Error Codes

- `100` - Invalid parameter
- `190` - Access token expired
- `200` - Missing permission
- `17` - Rate limit exceeded
- `2` - Temporary API error

---

## Rate Limiting

Meta API has rate limits:
- **200 calls per hour** per user per app
- **200 calls per hour** per app
- Exceeded limits return error code `17`

**Best Practices:**
- Cache responses when possible
- Use batch requests for bulk operations
- Implement exponential backoff on rate limit errors

---

## Examples

### Complete Campaign Creation Flow

```typescript
// 1. Create campaign
const campaign = await fetch('/api/campaigns?adAccountId=123&tenant=my-tenant', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Q1 2025 Sale',
    objective: 'OUTCOME_SALES',
    dailyBudget: 100,
    status: 'PAUSED',
  }),
});

const { data: campaignData } = await campaign.json();
console.log('Campaign created:', campaignData.id);

// 2. Create ad (requires ad set first)
// ... create ad set ...

// 3. Get insights
const insights = await fetch(
  `/api/insights?objectId=${campaignData.id}&level=campaign&datePreset=lifetime&tenant=my-tenant`
);

const { data: insightsData } = await insights.json();
console.log('Spend:', insightsData.aggregated.spend);
console.log('ROAS:', insightsData.aggregated.actionValues.purchase / insightsData.aggregated.spend);
```

### Error Handling Example

```typescript
try {
  const response = await fetch('/api/campaigns', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(campaignData),
  });

  if (!response.ok) {
    const error = await response.json();
    
    if (response.status === 400) {
      console.error('Validation error:', error.details);
    } else if (response.status === 401) {
      console.error('Unauthorized - token expired?');
      // Redirect to OAuth flow
    } else {
      console.error('API error:', error);
    }
    return;
  }

  const data = await response.json();
  console.log('Success:', data);
} catch (error) {
  console.error('Network error:', error);
}
```

---

## Next Steps

1. **Copy API routes** to your Next.js app:
   ```bash
   cp -r examples/api/* pages/api/
   # or for App Router:
   cp -r examples/api/* app/api/
   ```

2. **Add authentication middleware** to validate tenantId

3. **Implement rate limiting** on your endpoints

4. **Add caching** for frequently accessed data

5. **Build UI** to consume these APIs

6. **Monitor** API usage and errors

---

## Resources

- [Meta Marketing API Docs](https://developers.facebook.com/docs/marketing-apis)
- [Campaign Structure](https://developers.facebook.com/docs/marketing-api/reference/ad-campaign-group)
- [Ad Creative Specs](https://developers.facebook.com/docs/marketing-api/reference/ad-creative)
- [Insights API](https://developers.facebook.com/docs/marketing-api/insights)
- [Error Codes](https://developers.facebook.com/docs/graph-api/using-graph-api/error-handling)
