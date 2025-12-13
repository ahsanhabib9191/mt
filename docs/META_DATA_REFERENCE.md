# Meta Ads Data Reference Guide

This guide covers all the data types you can retrieve from Meta's Marketing API, including Pixel data, Business Manager metrics, and detailed targeting options.

> **Note:** This is a reference guide for data structures. For OAuth implementation, see [META_OAUTH_INTEGRATION.md](META_OAUTH_INTEGRATION.md).

## Table of Contents

1. [Facebook Pixel Data](#facebook-pixel-data)
2. [Business Manager Data](#business-manager-data)
3. [Ad Account Metrics](#ad-account-metrics)
4. [Targeting & Audience Data](#targeting--audience-data)
5. [Placement Options](#placement-options)
6. [Optimization Goals](#optimization-goals)
7. [Complete API Field Reference](#complete-api-field-reference)

---

## Facebook Pixel Data

Facebook Pixel tracks user actions on your website and provides conversion data for ad optimization.

### 1. Pixel Configuration

```typescript
interface IPixelConfig {
  pixelId: string;
  name: string;
  code?: string; // Pixel installation code
  lastFiredTime?: Date;
  isUnavailable?: boolean;
  createdTime: Date;
}
```

### 2. Standard Events

Facebook Pixel tracks these standard events:

```typescript
const STANDARD_EVENTS = [
  'ViewContent',       // Product page view
  'Search',           // Search performed
  'AddToCart',        // Item added to cart
  'AddToWishlist',    // Item added to wishlist
  'InitiateCheckout', // Checkout started
  'AddPaymentInfo',   // Payment info added
  'Purchase',         // Purchase completed
  'Lead',             // Lead form submitted
  'CompleteRegistration', // Account created
  'Contact',          // Contact initiated
  'CustomizeProduct', // Product customization
  'Donate',           // Donation made
  'FindLocation',     // Store locator used
  'Schedule',         // Appointment scheduled
  'StartTrial',       // Free trial started
  'SubmitApplication', // Application submitted
  'Subscribe'         // Subscription purchased
];
```

### 3. Fetching Pixel Data

```typescript
import { fetchGraphNode, fetchGraphEdges } from '@your-org/meta-ad-db/lib/services/meta-sync/graph-client';

async function getPixelData(pixelId: string, accessToken: string) {
  // Get pixel configuration
  const pixelConfig = await fetchGraphNode(
    accessToken,
    pixelId,
    { fields: 'id,name,code,last_fired_time,is_unavailable,created_time' }
  );
  
  return pixelConfig;
}

async function getPixelStats(pixelId: string, accessToken: string) {
  // Get pixel event statistics
  const stats = await fetchGraphNode(
    accessToken,
    `${pixelId}/stats`,
    {
      start_time: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      end_time: new Date().toISOString(),
      aggregation: 'event'
    }
  );
  
  return stats;
}

async function getPixelCustomConversions(pixelId: string, accessToken: string) {
  // Get custom conversion events
  const conversions = await fetchGraphEdges(
    accessToken,
    `${pixelId}/customconversions`,
    { fields: 'id,name,rule,event_source_type,custom_event_type' }
  );
  
  return conversions;
}
```

### 4. Custom Events

You can track custom events beyond standard events:

```typescript
interface ICustomEvent {
  eventName: string;
  eventTime: Date;
  eventSourceUrl?: string;
  userAgent?: string;
  userData?: {
    em?: string;      // Email (hashed)
    ph?: string;      // Phone (hashed)
    external_id?: string;
    client_user_agent?: string;
    fbc?: string;     // Facebook click ID
    fbp?: string;     // Facebook browser ID
  };
  customData?: {
    value?: number;
    currency?: string;
    content_name?: string;
    content_category?: string;
    content_ids?: string[];
    contents?: Array<{
      id: string;
      quantity: number;
      item_price?: number;
    }>;
  };
}
```

### 5. Conversion API Integration

Server-side event tracking for better accuracy:

```typescript
async function sendConversionEvent(pixelId: string, accessToken: string, event: ICustomEvent) {
  const url = `https://graph.facebook.com/v21.0/${pixelId}/events`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      data: [{
        event_name: event.eventName,
        event_time: Math.floor(event.eventTime.getTime() / 1000),
        event_source_url: event.eventSourceUrl,
        user_data: event.userData,
        custom_data: event.customData,
        action_source: 'website'
      }],
      access_token: accessToken
    })
  });
  
  return response.json();
}
```

---

## Business Manager Data

Business Manager provides organizational-level data and historical metrics.

### 1. Business Account Information

```typescript
interface IBusinessAccount {
  id: string;
  name: string;
  created_time: Date;
  timezone_id: number;
  timezone_offset_hours_utc: number;
  primary_page?: {
    id: string;
    name: string;
  };
  verification_status: 'not_verified' | 'verified' | 'denied';
  business_users?: Array<{
    id: string;
    name: string;
    email: string;
    role: string;
  }>;
}

async function getBusinessInfo(businessId: string, accessToken: string) {
  const fields = [
    'id',
    'name',
    'created_time',
    'timezone_id',
    'timezone_offset_hours_utc',
    'primary_page{id,name}',
    'verification_status'
  ];
  
  const business = await fetchGraphNode(
    accessToken,
    businessId,
    { fields: fields.join(',') }
  );
  
  // Calculate business age in days
  const createdDate = new Date(business.created_time);
  const ageDays = Math.floor((Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
  
  return {
    ...business,
    ageDays,
    ageMonths: Math.floor(ageDays / 30),
    ageYears: Math.floor(ageDays / 365)
  };
}
```

### 2. Historical Ad Spend

```typescript
interface IAdSpendHistory {
  date: Date;
  spend: number;
  currency: string;
  accountId: string;
}

async function getHistoricalAdSpend(
  adAccountId: string, 
  accessToken: string,
  startDate: Date,
  endDate: Date
) {
  const insights = await fetchGraphEdges(
    accessToken,
    `${adAccountId}/insights`,
    {
      time_range: JSON.stringify({
        since: startDate.toISOString().split('T')[0],
        until: endDate.toISOString().split('T')[0]
      }),
      time_increment: 1, // Daily
      fields: 'spend,date_start,account_currency',
      level: 'account'
    }
  );
  
  return insights.map((insight: any) => ({
    date: new Date(insight.date_start),
    spend: parseFloat(insight.spend),
    currency: insight.account_currency,
    accountId: adAccountId
  }));
}

async function getTotalLifetimeSpend(adAccountId: string, accessToken: string) {
  const account = await fetchGraphNode(
    accessToken,
    adAccountId,
    { fields: 'spend_cap,amount_spent,balance,account_status,created_time' }
  );
  
  return {
    totalSpent: parseFloat(account.amount_spent),
    spendCap: account.spend_cap ? parseFloat(account.spend_cap) : null,
    balance: parseFloat(account.balance),
    currency: account.account_currency,
    accountAge: Math.floor((Date.now() - new Date(account.created_time).getTime()) / (1000 * 60 * 60 * 24)),
    status: account.account_status
  };
}
```

### 3. Business-Owned Assets

```typescript
async function getBusinessAssets(businessId: string, accessToken: string) {
  const [adAccounts, pages, pixels, catalogs, apps] = await Promise.all([
    // Ad Accounts
    fetchGraphEdges(accessToken, `${businessId}/owned_ad_accounts`, {
      fields: 'id,name,account_status,amount_spent,currency,disable_reason'
    }),
    
    // Pages
    fetchGraphEdges(accessToken, `${businessId}/owned_pages`, {
      fields: 'id,name,fan_count,category,verification_status'
    }),
    
    // Pixels
    fetchGraphEdges(accessToken, `${businessId}/owned_pixels`, {
      fields: 'id,name,last_fired_time,is_unavailable'
    }),
    
    // Product Catalogs
    fetchGraphEdges(accessToken, `${businessId}/owned_product_catalogs`, {
      fields: 'id,name,product_count,vertical'
    }),
    
    // Apps
    fetchGraphEdges(accessToken, `${businessId}/owned_apps`, {
      fields: 'id,name,link,category'
    })
  ]);
  
  return {
    adAccounts,
    pages,
    pixels,
    catalogs,
    apps,
    summary: {
      totalAdAccounts: adAccounts.length,
      totalPages: pages.length,
      totalPixels: pixels.length,
      totalCatalogs: catalogs.length,
      totalApps: apps.length
    }
  };
}
```

---

## Ad Account Metrics

### 1. Account-Level Statistics

```typescript
async function getAdAccountStats(adAccountId: string, accessToken: string) {
  const fields = [
    'id',
    'name',
    'account_status',
    'age',
    'amount_spent',
    'balance',
    'currency',
    'spend_cap',
    'business',
    'funding_source_details',
    'created_time',
    'timezone_name',
    'min_daily_budget',
    'disable_reason'
  ];
  
  const account = await fetchGraphNode(
    accessToken,
    adAccountId,
    { fields: fields.join(',') }
  );
  
  return account;
}

async function getAccountInsights(
  adAccountId: string,
  accessToken: string,
  days: number = 30
) {
  const insights = await fetchGraphNode(
    accessToken,
    `${adAccountId}/insights`,
    {
      time_range: JSON.stringify({
        since: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        until: new Date().toISOString().split('T')[0]
      }),
      fields: [
        'spend',
        'impressions',
        'reach',
        'clicks',
        'cpc',
        'cpm',
        'ctr',
        'frequency',
        'actions',
        'conversions',
        'cost_per_action_type'
      ].join(',')
    }
  );
  
  return insights;
}
```

---

## Targeting & Audience Data

### 1. Interest Targeting

```typescript
interface IInterestTargeting {
  id: string;
  name: string;
  audience_size_lower_bound: number;
  audience_size_upper_bound: number;
  path: string[];
  description?: string;
  topic?: string;
}

async function searchInterests(query: string, accessToken: string) {
  const interests = await fetchGraphEdges(
    accessToken,
    'search',
    {
      type: 'adinterest',
      q: query,
      limit: '100'
    }
  );
  
  return interests;
}

async function getInterestSuggestions(interestId: string, accessToken: string) {
  const suggestions = await fetchGraphEdges(
    accessToken,
    `${interestId}/suggested_interests`,
    { limit: '50' }
  );
  
  return suggestions;
}
```

### 2. Custom Audiences

```typescript
interface ICustomAudience {
  id: string;
  name: string;
  subtype: 'CUSTOM' | 'WEBSITE' | 'APP' | 'OFFLINE_CONVERSION' | 'ENGAGEMENT' | 'VIDEO' | 'LOOKALIKE';
  description?: string;
  approximate_count?: number;
  operation_status?: {
    code: number;
    description: string;
  };
  retention_days?: number;
  rule?: string;
  data_source?: {
    type: string;
    sub_type: string;
  };
  delivery_status?: {
    code: number;
    description: string;
  };
  time_created: Date;
  time_updated: Date;
}

async function getCustomAudiences(adAccountId: string, accessToken: string) {
  const audiences = await fetchGraphEdges(
    accessToken,
    `${adAccountId}/customaudiences`,
    {
      fields: [
        'id',
        'name',
        'subtype',
        'description',
        'approximate_count',
        'operation_status',
        'delivery_status',
        'retention_days',
        'rule',
        'data_source',
        'time_created',
        'time_updated'
      ].join(',')
    }
  );
  
  return audiences;
}

async function createCustomAudience(
  adAccountId: string,
  accessToken: string,
  audienceData: {
    name: string;
    subtype: 'CUSTOM' | 'WEBSITE' | 'ENGAGEMENT';
    description?: string;
    customer_file_source?: 'USER_PROVIDED_ONLY' | 'PARTNER_PROVIDED_ONLY' | 'BOTH_USER_AND_PARTNER_PROVIDED';
  }
) {
  const response = await fetch(
    `https://graph.facebook.com/v21.0/${adAccountId}/customaudiences`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...audienceData,
        access_token: accessToken
      })
    }
  );
  
  return response.json();
}
```

### 3. Lookalike Audiences

```typescript
interface ILookalikeAudience {
  id: string;
  name: string;
  lookalike_spec: {
    type: 'SIMILARITY' | 'REACH';
    ratio: number; // 0.01 = 1%, 0.10 = 10%
    country: string;
    starting_ratio?: number;
    origin: Array<{
      id: string;
      type: string;
    }>;
  };
  approximate_count?: number;
  operation_status: {
    code: number;
    description: string;
  };
}

async function createLookalikeAudience(
  adAccountId: string,
  accessToken: string,
  sourceAudienceId: string,
  country: string,
  ratio: number = 0.01 // 1%
) {
  const response = await fetch(
    `https://graph.facebook.com/v21.0/${adAccountId}/customaudiences`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `Lookalike ${Math.floor(ratio * 100)}% - ${country}`,
        subtype: 'LOOKALIKE',
        lookalike_spec: JSON.stringify({
          type: 'SIMILARITY',
          ratio: ratio,
          country: country,
          origin: [{
            id: sourceAudienceId,
            type: 'custom_audience'
          }]
        }),
        access_token: accessToken
      })
    }
  );
  
  return response.json();
}

async function getLookalikeAudiences(adAccountId: string, accessToken: string) {
  const audiences = await fetchGraphEdges(
    accessToken,
    `${adAccountId}/customaudiences`,
    {
      fields: 'id,name,subtype,lookalike_spec,approximate_count,operation_status',
      filtering: JSON.stringify([{
        field: 'subtype',
        operator: 'EQUAL',
        value: 'LOOKALIKE'
      }])
    }
  );
  
  return audiences;
}
```

### 4. Retargeting Audiences

```typescript
// Website retargeting based on Pixel events
async function createWebsiteRetargetingAudience(
  adAccountId: string,
  pixelId: string,
  accessToken: string,
  config: {
    name: string;
    retentionDays: number; // 1-180 days
    event: string; // e.g., 'ViewContent', 'AddToCart'
    urlRules?: Array<{
      operator: 'i_contains' | 'i_not_contains' | 'i_equals';
      value: string;
    }>;
  }
) {
  const rule = {
    inclusions: {
      operator: 'or',
      rules: [{
        event_sources: [{
          id: pixelId,
          type: 'pixel'
        }],
        retention_seconds: config.retentionDays * 24 * 60 * 60,
        filter: {
          operator: 'and',
          filters: [
            {
              field: 'event',
              operator: 'eq',
              value: config.event
            },
            ...(config.urlRules || []).map(rule => ({
              field: 'url',
              operator: rule.operator,
              value: rule.value
            }))
          ]
        }
      }]
    }
  };
  
  const response = await fetch(
    `https://graph.facebook.com/v21.0/${adAccountId}/customaudiences`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: config.name,
        subtype: 'WEBSITE',
        description: `Retarget users who ${config.event} in last ${config.retentionDays} days`,
        rule: JSON.stringify(rule),
        retention_days: config.retentionDays,
        access_token: accessToken
      })
    }
  );
  
  return response.json();
}

// Page/Post engagement retargeting
async function createEngagementRetargetingAudience(
  adAccountId: string,
  pageId: string,
  accessToken: string,
  config: {
    name: string;
    retentionDays: number;
    engagementType: 'page' | 'video' | 'lead_form' | 'event';
  }
) {
  const response = await fetch(
    `https://graph.facebook.com/v21.0/${adAccountId}/customaudiences`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: config.name,
        subtype: 'ENGAGEMENT',
        description: `People who engaged with ${config.engagementType}`,
        retention_days: config.retentionDays,
        rule: JSON.stringify({
          inclusions: {
            operator: 'or',
            rules: [{
              event_sources: [{
                id: pageId,
                type: config.engagementType
              }],
              retention_seconds: config.retentionDays * 24 * 60 * 60
            }]
          }
        }),
        access_token: accessToken
      })
    }
  );
  
  return response.json();
}
```

### 5. Demographic Targeting

```typescript
interface IDemographicTargeting {
  age_min?: number;       // 13-65
  age_max?: number;       // 13-65
  genders?: Array<1 | 2>; // 1 = male, 2 = female
  locales?: number[];     // Language codes
  education_statuses?: Array<
    1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13
  >; // Education levels
  relationship_statuses?: Array<
    1 | 2 | 3 | 4 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13
  >; // Relationship statuses
  interested_in?: Array<1 | 2 | 3 | 4>; // Interested in (for dating)
  life_events?: Array<{
    id: string;
    name: string;
  }>;
  work_employers?: Array<{
    id: string;
    name: string;
  }>;
  work_positions?: Array<{
    id: string;
    name: string;
  }>;
  education_schools?: Array<{
    id: string;
    name: string;
  }>;
  education_majors?: Array<{
    id: string;
    name: string;
  }>;
}
```

### 6. Geographic Targeting

```typescript
interface IGeoTargeting {
  countries?: string[];      // ISO country codes ['US', 'GB']
  regions?: Array<{
    key: string;            // Region ID
    name?: string;
  }>;
  cities?: Array<{
    key: string;            // City ID
    radius?: number;        // Miles/KM
    distance_unit?: 'mile' | 'kilometer';
    name?: string;
  }>;
  zips?: Array<{
    key: string;            // ZIP/postal code
    name?: string;
  }>;
  geo_markets?: Array<{
    key: string;            // DMA code
    name?: string;
  }>;
  location_types?: Array<
    'home' | 'recent' | 'travel_in'
  >;
  excluded_geo_locations?: {
    countries?: string[];
    regions?: Array<{ key: string }>;
    cities?: Array<{ key: string }>;
  };
}

async function searchLocations(
  query: string,
  locationType: 'country' | 'region' | 'city' | 'zip',
  accessToken: string
) {
  const locations = await fetchGraphEdges(
    accessToken,
    'search',
    {
      type: 'adgeolocation',
      location_types: JSON.stringify([locationType]),
      q: query,
      limit: '100'
    }
  );
  
  return locations;
}

async function getTargetingReach(
  adAccountId: string,
  accessToken: string,
  targeting: any
) {
  const response = await fetch(
    `https://graph.facebook.com/v21.0/${adAccountId}/reachestimate`,
    {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    }
  );
  
  const params = new URLSearchParams({
    targeting_spec: JSON.stringify(targeting),
    access_token: accessToken
  });
  
  const reach = await fetch(
    `https://graph.facebook.com/v21.0/${adAccountId}/reachestimate?${params}`
  );
  
  return reach.json();
}
```

---

## Placement Options

### 1. Automatic Placements vs Manual

```typescript
type PlacementType = 'automatic' | 'manual';

interface IPlacementConfig {
  publisher_platforms?: Array<'facebook' | 'instagram' | 'audience_network' | 'messenger'>;
  facebook_positions?: Array<
    'feed' | 'instant_article' | 'marketplace' | 'video_feeds' | 
    'story' | 'search' | 'instream_video' | 'right_hand_column'
  >;
  instagram_positions?: Array<
    'stream' | 'story' | 'explore' | 'reels' | 'profile_feed' | 'search'
  >;
  audience_network_positions?: Array<
    'classic' | 'instream_video' | 'rewarded_video'
  >;
  messenger_positions?: Array<
    'messenger_home' | 'sponsored_messages' | 'story'
  >;
  device_platforms?: Array<'mobile' | 'desktop'>;
}

const PLACEMENT_RECOMMENDATIONS = {
  awareness: {
    // Best for awareness campaigns
    publisher_platforms: ['facebook', 'instagram'],
    facebook_positions: ['feed', 'story', 'video_feeds'],
    instagram_positions: ['stream', 'story', 'reels'],
    device_platforms: ['mobile', 'desktop']
  },
  consideration: {
    // Best for engagement/traffic
    publisher_platforms: ['facebook', 'instagram', 'audience_network'],
    facebook_positions: ['feed', 'marketplace', 'video_feeds', 'story'],
    instagram_positions: ['stream', 'explore', 'reels'],
    device_platforms: ['mobile']
  },
  conversion: {
    // Best for conversions
    publisher_platforms: ['facebook', 'instagram'],
    facebook_positions: ['feed', 'marketplace'],
    instagram_positions: ['stream', 'explore'],
    device_platforms: ['mobile', 'desktop']
  }
};

async function getPlacementBreakdown(
  adSetId: string,
  accessToken: string,
  days: number = 7
) {
  const insights = await fetchGraphEdges(
    accessToken,
    `${adSetId}/insights`,
    {
      time_range: JSON.stringify({
        since: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        until: new Date().toISOString().split('T')[0]
      }),
      breakdowns: 'publisher_platform,platform_position',
      fields: 'impressions,clicks,spend,cpc,cpm,ctr,conversions'
    }
  );
  
  return insights;
}
```

---

## Optimization Goals

### 1. Campaign Objectives & Optimization Goals

```typescript
const OPTIMIZATION_GOALS = {
  AWARENESS: [
    'REACH',              // Maximize reach
    'IMPRESSIONS',        // Maximize impressions
    'AD_RECALL_LIFT',     // Ad recall
    'VIDEO_VIEWS'         // Video views (ThruPlay)
  ],
  CONSIDERATION: [
    'LINK_CLICKS',        // Landing page views
    'POST_ENGAGEMENT',    // Post engagement
    'PAGE_LIKES',         // Page likes
    'EVENT_RESPONSES',    // Event responses
    'LEAD_GENERATION',    // Lead generation
    'MESSAGES',           // Messages
    'VIDEO_VIEWS',        // Video views
    'THRUPLAY'            // Video plays (15s or complete)
  ],
  CONVERSION: [
    'OFFSITE_CONVERSIONS', // Website conversions
    'CONVERSATIONS',       // Messenger conversations
    'PRODUCT_CATALOG_SALES', // Catalog sales
    'STORE_VISITS',        // Store visits
    'VALUE',               // Conversion value
    'APP_INSTALLS'         // App installs
  ]
};

interface IOptimizationConfig {
  optimization_goal: string;
  billing_event?: 'IMPRESSIONS' | 'LINK_CLICKS' | 'APP_INSTALLS' | 'THRUPLAY';
  bid_strategy?: 'LOWEST_COST_WITHOUT_CAP' | 'LOWEST_COST_WITH_BID_CAP' | 'COST_CAP' | 'TARGET_COST';
  bid_amount?: number;
  promoted_object?: {
    pixel_id?: string;
    custom_event_type?: string;
    application_id?: string;
    object_store_url?: string;
    page_id?: string;
    event_id?: string;
  };
  attribution_spec?: Array<{
    event_type: 'CLICK_THROUGH' | 'VIEW_THROUGH';
    window_days: 1 | 7 | 28;
  }>;
}

const ATTRIBUTION_WINDOWS = {
  '1_day_click': { event_type: 'CLICK_THROUGH', window_days: 1 },
  '7_day_click': { event_type: 'CLICK_THROUGH', window_days: 7 },
  '28_day_click': { event_type: 'CLICK_THROUGH', window_days: 28 },
  '1_day_view': { event_type: 'VIEW_THROUGH', window_days: 1 },
  '7_day_view': { event_type: 'VIEW_THROUGH', window_days: 7 }
};
```

### 2. Fetching Optimization Recommendations

```typescript
async function getOptimizationSuggestions(
  adSetId: string,
  accessToken: string
) {
  const suggestions = await fetchGraphEdges(
    accessToken,
    `${adSetId}/delivery_estimate`,
    {
      optimization_goal: 'OFFSITE_CONVERSIONS',
      promoted_object: JSON.stringify({
        pixel_id: 'YOUR_PIXEL_ID',
        custom_event_type: 'PURCHASE'
      })
    }
  );
  
  return suggestions;
}
```

---

## Complete API Field Reference

### Ad Account Fields

```typescript
const AD_ACCOUNT_FIELDS = [
  'id', 'account_id', 'name', 'account_status',
  'age', 'amount_spent', 'balance', 'business',
  'business_city', 'business_country_code', 'business_name',
  'business_state', 'business_street', 'business_street2',
  'business_zip', 'capabilities', 'created_time',
  'currency', 'disable_reason', 'end_advertiser',
  'end_advertiser_name', 'funding_source', 'funding_source_details',
  'has_migrated_permissions', 'io_number', 'is_attribution_spec_system_default',
  'is_direct_deals_enabled', 'is_in_3ds_authorization_enabled_market',
  'is_notifications_enabled', 'is_personal', 'is_prepay_account',
  'is_tax_id_required', 'line_numbers', 'media_agency',
  'min_campaign_group_spend_cap', 'min_daily_budget', 'name',
  'offsite_pixels_tos_accepted', 'owner', 'partner',
  'spend_cap', 'tax_id', 'tax_id_status', 'tax_id_type',
  'timezone_id', 'timezone_name', 'timezone_offset_hours_utc',
  'user_access_expire_time', 'user_tasks', 'user_tos_accepted'
];
```

### Campaign Fields

```typescript
const CAMPAIGN_FIELDS = [
  'id', 'name', 'objective', 'status', 'budget_remaining',
  'buying_type', 'created_time', 'daily_budget', 'effective_status',
  'lifetime_budget', 'spend_cap', 'start_time', 'stop_time',
  'updated_time', 'bid_strategy', 'special_ad_categories',
  'special_ad_category', 'promoted_object', 'source_campaign',
  'topline_id', 'pacing_type', 'budget_rebalance_flag',
  'is_skadnetwork_attribution', 'smart_promotion_type'
];
```

### Ad Set Fields

```typescript
const AD_SET_FIELDS = [
  'id', 'name', 'status', 'effective_status', 'campaign_id',
  'daily_budget', 'lifetime_budget', 'budget_remaining',
  'billing_event', 'bid_amount', 'bid_strategy',
  'optimization_goal', 'promoted_object', 'targeting',
  'start_time', 'end_time', 'created_time', 'updated_time',
  'attribution_spec', 'contextual_bundling_spec',
  'destination_type', 'is_dynamic_creative', 'learning_stage_info',
  'multi_optimization_goal_weight', 'pacing_type',
  'recurring_budget_semantics', 'review_feedback',
  'rf_prediction_id', 'source_adset', 'source_adset_id',
  'time_based_ad_rotation_id_blocks', 'time_based_ad_rotation_intervals',
  'use_new_app_click'
];
```

### Ad Fields

```typescript
const AD_FIELDS = [
  'id', 'name', 'adset_id', 'campaign_id', 'status',
  'effective_status', 'creative', 'tracking_specs',
  'conversion_specs', 'bid_amount', 'created_time',
  'updated_time', 'last_updated_by_app_id', 'preview_shareable_link',
  'recommendations', 'source_ad', 'source_ad_id'
];
```

### Insights Fields

```typescript
const INSIGHTS_FIELDS = [
  'impressions', 'reach', 'frequency', 'clicks', 'unique_clicks',
  'spend', 'cpc', 'cpm', 'cpp', 'ctr', 'unique_ctr',
  'cost_per_unique_click', 'cost_per_inline_link_click',
  'inline_link_clicks', 'inline_link_click_ctr', 'inline_post_engagement',
  'actions', 'action_values', 'conversions', 'conversion_values',
  'cost_per_action_type', 'cost_per_conversion',
  'video_play_actions', 'video_avg_time_watched_actions',
  'video_p25_watched_actions', 'video_p50_watched_actions',
  'video_p75_watched_actions', 'video_p100_watched_actions',
  'website_ctr', 'website_purchase_roas', 'purchase_roas'
];
```

---

## Data Storage in Database

This repository provides models to store Meta data locally:

```typescript
// Store targeting configuration in AdSet model
import { AdSetModel, ITargeting } from '@your-org/meta-ad-db/lib/db/models/ad-set';

const targeting: ITargeting = {
  audienceSize: 2500000,
  ageMin: 25,
  ageMax: 45,
  genders: [1, 2],
  locations: ['US', 'GB', 'CA'],
  interests: ['123456789', '987654321'],
  customAudiences: ['23850000000000000'],
  lookalikes: ['23850000000000001'],
  exclusions: {
    customAudiences: ['23850000000000002']
  }
};

// Store audience insights
import { AudienceInsightModel } from '@your-org/meta-ad-db/lib/db/models/audience-insight';

await AudienceInsightModel.create({
  entityType: 'AD_SET',
  entityId: 'adset_123',
  dimension: 'AGE',
  value: '25-34',
  date: new Date(),
  impressions: 50000,
  clicks: 1250,
  conversions: 45,
  spend: 450.00,
  revenue: 2250.00
});
```

---

## References

- [Meta Marketing API - Targeting](https://developers.facebook.com/docs/marketing-api/audiences/reference/targeting)
- [Meta Pixel Events](https://developers.facebook.com/docs/meta-pixel/reference)
- [Conversion API](https://developers.facebook.com/docs/marketing-api/conversions-api)
- [Business Manager API](https://developers.facebook.com/docs/marketing-api/business-manager)
- [Ad Insights](https://developers.facebook.com/docs/marketing-api/insights)
- [Custom Audiences](https://developers.facebook.com/docs/marketing-api/audiences/reference/custom-audience)
- [Optimization Goals](https://developers.facebook.com/docs/marketing-api/optimization-goals)
