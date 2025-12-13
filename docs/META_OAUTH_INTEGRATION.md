# Meta (Facebook) OAuth Integration Guide

This guide explains how to implement Facebook Login with Business Manager access and retrieve Facebook Pages using this database layer.

> **Note:** Code examples use `@your-org/meta-ad-db` as a placeholder for this package. Replace it with the actual package name when you install this repository (e.g., if installed locally or from Git, adjust import paths accordingly).

> **See Also:** For comprehensive data reference including Pixel data, targeting options, and all available API fields, see the **[Meta Ads Data Reference Guide](META_DATA_REFERENCE.md)**.

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [OAuth Flow Implementation](#oauth-flow-implementation)
4. [Business Manager Integration](#business-manager-integration)
5. [Listing Facebook Pages](#listing-facebook-pages)
6. [Complete Example](#complete-example)
7. [Troubleshooting](#troubleshooting)

## Overview

This repository provides the database layer and utilities for Meta OAuth integration. The flow is:

```
User clicks "Login with Facebook"
    ↓
Redirect to Facebook OAuth (with scopes)
    ↓
User authorizes app → Facebook redirects back
    ↓
Exchange code for access token
    ↓
Store token in MetaConnection model (encrypted)
    ↓
Fetch Business Manager accounts
    ↓
List Facebook Pages from Business Manager
```

## Prerequisites

### 1. Create a Meta/Facebook App

1. Go to [Meta for Developers](https://developers.facebook.com/)
2. Create a new app (type: "Business")
3. Add **Facebook Login** product
4. Configure OAuth redirect URIs in app settings
5. Note your **App ID** and **App Secret**

### 2. Required Permissions (Scopes)

The following scopes are defined in `lib/utils/meta-scopes.ts`:

**Required:**
- `business_management` - Access Business Manager accounts
- `pages_read_engagement` - Read page engagement metrics
- `ads_management` - Create and manage ads
- `ads_read` - Read ads performance

**Optional:**
- `instagram_basic` - Read Instagram account info
- `instagram_content_publish` - Publish to Instagram
- `leads_retrieval` - Retrieve leads from ads

### 3. Environment Variables

Add to your `.env`:

```bash
# Meta App Credentials
META_APP_ID=your-app-id-here
META_APP_SECRET=your-app-secret-here

# OAuth Redirect
META_OAUTH_REDIRECT_URI=https://yourdomain.com/api/auth/facebook/callback

# Graph API Version
META_GRAPH_VERSION=v21.0
```

## OAuth Flow Implementation

### Step 1: Generate Authorization URL

Use the utility function to create the Facebook OAuth URL:

```typescript
import { generateAuthUrl } from '@your-org/meta-ad-db/lib/utils/meta-scopes';

export function GET(request: Request) {
  const appId = process.env.META_APP_ID!;
  const redirectUri = process.env.META_OAUTH_REDIRECT_URI!;
  const state = crypto.randomBytes(16).toString('hex'); // CSRF protection
  
  // Store state in session/cookie for verification
  
  const authUrl = generateAuthUrl(appId, redirectUri, state);
  
  return Response.redirect(authUrl);
}
```

**Generated URL:**
```
https://www.facebook.com/v21.0/dialog/oauth?
  client_id=YOUR_APP_ID
  &redirect_uri=https://yourdomain.com/api/auth/facebook/callback
  &state=RANDOM_STATE
  &scope=ads_management,ads_read,business_management,pages_read_engagement,instagram_basic,instagram_content_publish,leads_retrieval
```

### Step 2: Handle OAuth Callback

Create a callback endpoint to exchange the authorization code for tokens:

```typescript
// app/api/auth/facebook/callback/route.ts
import { MetaConnection } from '@your-org/meta-ad-db/lib/db/models/MetaConnection';
import { validateScopes } from '@your-org/meta-ad-db/lib/utils/meta-scopes';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  
  // 1. Verify state (CSRF protection)
  // ... verify state matches session
  
  if (!code) {
    return Response.json({ error: 'No authorization code' }, { status: 400 });
  }
  
  // 2. Exchange code for access token
  const tokenUrl = new URL('https://graph.facebook.com/v21.0/oauth/access_token');
  tokenUrl.searchParams.set('client_id', process.env.META_APP_ID!);
  tokenUrl.searchParams.set('client_secret', process.env.META_APP_SECRET!);
  tokenUrl.searchParams.set('redirect_uri', process.env.META_OAUTH_REDIRECT_URI!);
  tokenUrl.searchParams.set('code', code);
  
  const tokenResponse = await fetch(tokenUrl.toString());
  const tokenData = await tokenResponse.json();
  
  if (!tokenResponse.ok || tokenData.error) {
    return Response.json({ error: 'Failed to exchange code' }, { status: 400 });
  }
  
  // 3. Get long-lived token (optional but recommended)
  const longLivedUrl = new URL('https://graph.facebook.com/v21.0/oauth/access_token');
  longLivedUrl.searchParams.set('grant_type', 'fb_exchange_token');
  longLivedUrl.searchParams.set('client_id', process.env.META_APP_ID!);
  longLivedUrl.searchParams.set('client_secret', process.env.META_APP_SECRET!);
  longLivedUrl.searchParams.set('fb_exchange_token', tokenData.access_token);
  
  const longLivedResponse = await fetch(longLivedUrl.toString());
  const longLivedData = await longLivedResponse.json();
  
  const accessToken = longLivedData.access_token || tokenData.access_token;
  const expiresIn = longLivedData.expires_in || tokenData.expires_in;
  
  // 4. Get user's granted permissions
  const debugUrl = new URL('https://graph.facebook.com/v21.0/debug_token');
  debugUrl.searchParams.set('input_token', accessToken);
  debugUrl.searchParams.set('access_token', `${process.env.META_APP_ID}|${process.env.META_APP_SECRET}`);
  
  const debugResponse = await fetch(debugUrl.toString());
  const debugData = await debugResponse.json();
  const grantedScopes = debugData.data?.scopes || [];
  
  // 5. Validate required scopes
  const scopeValidation = validateScopes(grantedScopes);
  if (!scopeValidation.valid) {
    return Response.json({ 
      error: 'Missing required permissions', 
      missing: scopeValidation.missing 
    }, { status: 400 });
  }
  
  // 6. Get user info
  const meUrl = new URL('https://graph.facebook.com/v21.0/me');
  meUrl.searchParams.set('access_token', accessToken);
  meUrl.searchParams.set('fields', 'id,name,email');
  
  const meResponse = await fetch(meUrl.toString());
  const userData = await meResponse.json();
  
  // 7. Get ad accounts
  const adAccountsUrl = new URL(`https://graph.facebook.com/v21.0/${userData.id}/adaccounts`);
  adAccountsUrl.searchParams.set('access_token', accessToken);
  adAccountsUrl.searchParams.set('fields', 'id,name,account_id');
  
  const adAccountsResponse = await fetch(adAccountsUrl.toString());
  const adAccountsData = await adAccountsResponse.json();
  const adAccounts = adAccountsData.data || [];
  
  // 8. Store connection for each ad account
  const tenantId = 'tenant-' + userData.id; // Or get from session
  
  for (const adAccount of adAccounts) {
    await MetaConnection.create({
      tenantId,
      adAccountId: adAccount.id,
      accessToken, // Will be encrypted automatically
      refreshToken: tokenData.refresh_token,
      tokenExpiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000) : undefined,
      permissions: grantedScopes,
      status: 'ACTIVE',
    });
  }
  
  return Response.json({ 
    success: true, 
    user: userData,
    adAccounts: adAccounts.length 
  });
}
```

## Business Manager Integration

### Fetch Business Manager Accounts

```typescript
import { fetchGraphEdges, buildGraphEdgeParams } from '@your-org/meta-ad-db/lib/services/meta-sync/graph-client';

async function getBusinessAccounts(userId: string, accessToken: string) {
  const fields = ['id', 'name', 'primary_page', 'timezone_offset_hours_utc'];
  const params = buildGraphEdgeParams(fields, 100);
  
  const businesses = await fetchGraphEdges(
    accessToken,
    `${userId}/businesses`,
    params
  );
  
  return businesses;
}
```

### Get Ad Accounts from Business Manager

```typescript
async function getBusinessAdAccounts(businessId: string, accessToken: string) {
  const fields = [
    'id',
    'account_id', 
    'name',
    'account_status',
    'currency',
    'timezone_name',
    'business'
  ];
  const params = buildGraphEdgeParams(fields, 100);
  
  const adAccounts = await fetchGraphEdges(
    accessToken,
    `${businessId}/owned_ad_accounts`,
    params
  );
  
  return adAccounts;
}
```

## Listing Facebook Pages

### Get All Pages User Manages

```typescript
async function getUserPages(userId: string, accessToken: string) {
  const fields = [
    'id',
    'name',
    'category',
    'access_token', // Page access token
    'tasks', // User's roles on the page
    'instagram_business_account'
  ];
  const params = buildGraphEdgeParams(fields, 100);
  
  const pages = await fetchGraphEdges(
    accessToken,
    `${userId}/accounts`,
    params
  );
  
  return pages;
}
```

### Get Pages from Business Manager

```typescript
async function getBusinessPages(businessId: string, accessToken: string) {
  const fields = [
    'id',
    'name',
    'category',
    'fan_count',
    'instagram_business_account',
    'verification_status'
  ];
  const params = buildGraphEdgeParams(fields, 100);
  
  const pages = await fetchGraphEdges(
    accessToken,
    `${businessId}/owned_pages`,
    params
  );
  
  return pages;
}
```

### Get Page Insights

```typescript
async function getPageInsights(pageId: string, pageAccessToken: string) {
  const fields = [
    'impressions',
    'reach',
    'engagement',
    'page_fans',
    'page_views_total'
  ];
  
  const params = {
    metric: fields.join(','),
    period: 'day',
    since: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    until: new Date().toISOString().split('T')[0]
  };
  
  const insights = await fetchGraphEdges(
    pageAccessToken,
    `${pageId}/insights`,
    params
  );
  
  return insights;
}
```

## Complete Example

Here's a complete Next.js API route that implements the full flow:

```typescript
// app/api/meta/pages/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { initializeDatabase } from '@your-org/meta-ad-db/lib/db';
import { MetaConnection } from '@your-org/meta-ad-db/lib/db/models/MetaConnection';
import { ensureConnectionAccessToken, fetchGraphEdges, buildGraphEdgeParams } from '@your-org/meta-ad-db/lib/services/meta-sync/graph-client';

export async function GET(request: NextRequest) {
  await initializeDatabase();
  
  // 1. Authenticate user (assume we have user session)
  const tenantId = 'tenant-123'; // Get from session
  
  // 2. Get Meta connection
  const connections = await MetaConnection.find({ tenantId, status: 'ACTIVE' });
  
  if (connections.length === 0) {
    return NextResponse.json({ 
      error: 'No Meta connection found. Please connect your Facebook account.' 
    }, { status: 404 });
  }
  
  const connection = connections[0];
  
  // 3. Ensure token is valid (auto-refresh if needed)
  const { accessToken } = await ensureConnectionAccessToken(connection);
  
  // 4. Get user ID from connection
  const meUrl = new URL('https://graph.facebook.com/v21.0/me');
  meUrl.searchParams.set('access_token', accessToken);
  
  const meResponse = await fetch(meUrl.toString());
  const userData = await meResponse.json();
  
  if (!userData.id) {
    return NextResponse.json({ error: 'Failed to get user info' }, { status: 500 });
  }
  
  // 5. Fetch pages
  const pageFields = [
    'id',
    'name',
    'category',
    'access_token',
    'tasks',
    'fan_count',
    'instagram_business_account{id,username,followers_count}'
  ];
  const pageParams = buildGraphEdgeParams(pageFields, 100);
  
  const pages = await fetchGraphEdges(
    accessToken,
    `${userData.id}/accounts`,
    pageParams
  );
  
  // 6. Fetch businesses
  const businessFields = ['id', 'name', 'primary_page'];
  const businessParams = buildGraphEdgeParams(businessFields, 100);
  
  const businesses = await fetchGraphEdges(
    accessToken,
    `${userData.id}/businesses`,
    businessParams
  );
  
  // 7. Fetch pages from each business
  const businessPages = [];
  for (const business of businesses) {
    const bizPageFields = ['id', 'name', 'category', 'fan_count'];
    const bizPageParams = buildGraphEdgeParams(bizPageFields, 100);
    
    const bizPages = await fetchGraphEdges(
      accessToken,
      `${business.id}/owned_pages`,
      bizPageParams
    );
    
    businessPages.push({
      business: business.name,
      pages: bizPages
    });
  }
  
  return NextResponse.json({
    user: {
      id: userData.id,
      name: userData.name
    },
    pages: {
      personal: pages.map(p => ({
        id: p.id,
        name: p.name,
        category: p.category,
        roles: p.tasks,
        instagram: p.instagram_business_account
      })),
      business: businessPages
    }
  });
}
```

## Troubleshooting

### Common Errors

#### 1. "Invalid OAuth access token"
- Token may have expired - use `ensureConnectionAccessToken()` to auto-refresh
- User may have revoked permissions - prompt re-authorization

#### 2. "Missing required permissions"
- Check that all required scopes are granted
- Use `validateScopes()` function to verify
- Prompt user to re-authorize with correct scopes

#### 3. "Cannot access Business Manager"
- Ensure user has `business_management` scope
- User must be an admin of the Business Manager account
- Check that Business Manager is properly linked to the app

#### 4. "No pages found"
- User may not manage any pages
- Check that `pages_read_engagement` scope is granted
- Verify page is linked to the Business Manager

### Testing

1. **Test OAuth Flow:**
```bash
# Visit in browser
https://yourdomain.com/api/auth/facebook
```

2. **Test Page Listing:**
```bash
curl -H "Authorization: Bearer YOUR_JWT" \
  https://yourdomain.com/api/meta/pages
```

3. **Verify Scopes:**
Use Facebook's [Access Token Debugger](https://developers.facebook.com/tools/debug/accesstoken/)

### Security Best Practices

1. **Always use HTTPS** in production
2. **Implement CSRF protection** with state parameter
3. **Store tokens encrypted** (handled automatically by MetaConnection model)
4. **Refresh tokens before expiry** (use `ensureConnectionAccessToken()`)
5. **Validate scopes** on every request
6. **Log OAuth errors** for security monitoring

## Next Steps

1. Implement webhook handlers to receive real-time updates from Meta
2. Add background jobs to sync page insights periodically
3. Build UI components for page selection and management
4. Implement page post scheduling and management

## References

- [Meta Graph API Documentation](https://developers.facebook.com/docs/graph-api/)
- [Facebook Login for Business](https://developers.facebook.com/docs/facebook-login/overview/)
- [Business Manager API](https://developers.facebook.com/docs/marketing-api/business-manager/)
- [Pages API](https://developers.facebook.com/docs/graph-api/reference/page/)
