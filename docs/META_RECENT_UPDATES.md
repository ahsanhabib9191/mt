# Meta Recent Updates & New Features Guide

This guide covers the latest Meta/Facebook advertising platform updates, new features, and API changes that impact ad campaign management and optimization.

> **Last Updated:** December 2024 | **Meta API Version:** v21.0+ | **Migration to v22.0:** Q1 2025

## Table of Contents

1. [Advantage+ Campaigns](#advantage-campaigns)
2. [Meta Advantage+ Creative](#meta-advantage-creative)
3. [API Version Updates (v21.0 → v22.0)](#api-version-updates)
4. [iOS 14.5+ Privacy & Attribution Changes](#ios-145-privacy--attribution-changes)
5. [Reels Placements & Video Formats](#reels-placements--video-formats)
6. [Meta Verified for Business](#meta-verified-for-business)
7. [Messaging API Updates](#messaging-api-updates)
8. [Implementation Guide](#implementation-guide)

---

## Advantage+ Campaigns

**What:** Meta's AI-powered campaign type that automates targeting, creative, and budget optimization using machine learning.

### Key Features

1. **Advantage+ Shopping Campaigns**
   - Automated audience targeting (replaces manual interest/demographic targeting)
   - Dynamic creative optimization across placements
   - Budget optimization across ad sets
   - Typically 10-20% better ROAS vs manual campaigns

2. **Advantage+ App Campaigns**
   - Simplified campaign setup for app installs
   - Automated optimization for app events
   - Cross-device attribution

3. **Advantage+ Catalog Ads**
   - Dynamic product ads powered by AI
   - Automatic product set creation
   - Predictive audiences

### Database Schema

```typescript
// Add to Campaign model
interface IAdvantagePlusConfig {
  enabled: boolean;
  type: 'SHOPPING' | 'APP' | 'CATALOG';
  settings: {
    audienceControls?: {
      countries?: string[];
      ageMin?: number;
      ageMax?: number;
      existingCustomers?: 'INCLUDE' | 'EXCLUDE' | 'TARGET_EXISTING';
    };
    budgetOptimization?: {
      enabled: boolean;
      strategy: 'MAXIMIZE_VALUE' | 'MAXIMIZE_CONVERSIONS';
    };
    creativeOptimization?: {
      enabled: boolean;
      testNewCreatives: boolean;
    };
  };
}

// Extend Campaign interface
export interface ICampaign extends Document {
  // ... existing fields
  advantagePlus?: IAdvantagePlusConfig;
  isAdvantagePlus?: boolean;
}
```

### Creating Advantage+ Campaigns

```typescript
import { fetchGraphNode } from '@your-org/meta-ad-db/lib/services/meta-sync/graph-client';

async function createAdvantagePlusShoppingCampaign(
  adAccountId: string,
  accessToken: string,
  config: {
    name: string;
    dailyBudget: number;
    countries: string[];
    pixelId: string;
    catalogId: string;
  }
) {
  const campaignResponse = await fetch(
    `https://graph.facebook.com/v21.0/${adAccountId}/campaigns`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: config.name,
        objective: 'OUTCOME_SALES',
        status: 'PAUSED',
        special_ad_categories: [],
        // Advantage+ specific
        buying_type: 'AUCTION',
        advantage_campaign_type: 'ADVANTAGE_SHOPPING', // Key field
        access_token: accessToken
      })
    }
  );
  
  const campaign = await campaignResponse.json();
  
  // Create Advantage+ ad set
  const adSetResponse = await fetch(
    `https://graph.facebook.com/v21.0/${adAccountId}/adsets`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: config.name + ' - Ad Set',
        campaign_id: campaign.id,
        billing_event: 'IMPRESSIONS',
        optimization_goal: 'OFFSITE_CONVERSIONS',
        bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
        daily_budget: config.dailyBudget * 100, // cents
        targeting: {
          // Minimal targeting for Advantage+
          geo_locations: {
            countries: config.countries
          },
          advantage_audience: 1, // Enable Advantage+ audience
        },
        promoted_object: {
          pixel_id: config.pixelId,
          custom_event_type: 'PURCHASE'
        },
        access_token: accessToken
      })
    }
  );
  
  return {
    campaign,
    adSet: await adSetResponse.json()
  };
}
```

### Performance Tracking

```typescript
async function getAdvantagePlusInsights(
  campaignId: string,
  accessToken: string
) {
  const insights = await fetchGraphNode(
    accessToken,
    `${campaignId}/insights`,
    {
      fields: [
        'campaign_name',
        'spend',
        'impressions',
        'clicks',
        'conversions',
        'cost_per_conversion',
        'purchase_roas',
        // Advantage+ specific metrics
        'advantage_audience_impressions', // Impressions from AI audience
        'advantage_audience_reach',
        'advantage_audience_frequency'
      ].join(','),
      date_preset: 'last_30d'
    }
  );
  
  return insights;
}
```

### Best Practices

**DO:**
- ✅ Give AI at least 7-14 days to learn (don't make changes)
- ✅ Use daily budgets 5-10x your target CPA
- ✅ Provide 6-10 creative assets (images/videos)
- ✅ Enable catalog for product campaigns
- ✅ Let AI handle audience expansion

**DON'T:**
- ❌ Narrow targeting too much (defeats AI purpose)
- ❌ Change budgets daily (disrupts learning)
- ❌ Mix Advantage+ and manual campaigns
- ❌ Use detailed targeting (AI handles this)

---

## Meta Advantage+ Creative

**What:** AI-powered creative optimization that automatically tests and combines creative elements (images, videos, text, CTAs) to find best-performing combinations.

### Features

1. **Dynamic Creative Testing**
   - Up to 10 images/videos per ad
   - Up to 5 text variations (headline, primary text, description)
   - Automatic combination testing
   - Real-time optimization

2. **Advantage+ Creative Enhancements**
   - Automatic image brightness/contrast adjustment
   - Template application
   - Text overlays
   - Music for Reels

3. **Catalog Creative Optimization**
   - Dynamic product showcasing
   - Personalized product selection per user
   - Automatic seasonal adjustments

### Database Schema

```typescript
interface IAdvantagePlusCreative {
  enabled: boolean;
  enhancements: {
    brightnessAdjustment?: boolean;
    contrastAdjustment?: boolean;
    musicGeneration?: boolean;
    templateApplication?: boolean;
  };
  dynamicCreative: {
    enabled: boolean;
    images: Array<{
      hash: string;
      url: string;
    }>;
    videos: Array<{
      hash: string;
      url: string;
    }>;
    headlines: string[];
    primaryTexts: string[];
    descriptions: string[];
    callsToAction: string[];
  };
}

// Extend Ad model
export interface IAd extends Document {
  // ... existing fields
  advantagePlusCreative?: IAdvantagePlusCreative;
}
```

### Creating Dynamic Creative Ads

```typescript
async function createAdvantagePlusCreativeAd(
  adSetId: string,
  accessToken: string,
  creative: {
    images: string[]; // URLs
    videos?: string[];
    headlines: string[];
    primaryTexts: string[];
    descriptions: string[];
    linkUrl: string;
  }
) {
  // Upload creative assets first
  const imageHashes = await Promise.all(
    creative.images.map(url => uploadImage(url, accessToken))
  );
  
  const videoHashes = creative.videos 
    ? await Promise.all(creative.videos.map(url => uploadVideo(url, accessToken)))
    : [];
  
  // Create dynamic creative ad
  const adResponse = await fetch(
    `https://graph.facebook.com/v21.0/act_${adAccountId}/ads`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Advantage+ Creative Ad',
        adset_id: adSetId,
        status: 'PAUSED',
        creative: {
          object_type: 'SHARE',
          dynamic_ad_voice: 'DYNAMIC', // Enable dynamic creative
          asset_feed_spec: {
            images: imageHashes.map(hash => ({ hash })),
            videos: videoHashes.map(hash => ({ video_id: hash })),
            bodies: creative.primaryTexts.map(text => ({ text })),
            titles: creative.headlines.map(text => ({ text })),
            descriptions: creative.descriptions.map(text => ({ text })),
            ad_formats: ['SINGLE_IMAGE', 'SINGLE_VIDEO'],
            call_to_action_types: ['SHOP_NOW', 'LEARN_MORE'],
            link_urls: [{ website_url: creative.linkUrl }]
          },
          // Advantage+ Creative enhancements
          degrees_of_freedom_spec: {
            creative_features_spec: {
              advantage_plus_creative: 1 // Enable enhancements
            }
          }
        },
        access_token: accessToken
      })
    }
  );
  
  return adResponse.json();
}

async function uploadImage(imageUrl: string, accessToken: string): Promise<string> {
  // Implementation depends on whether URL is external or already uploaded
  const response = await fetch(
    `https://graph.facebook.com/v21.0/act_${adAccountId}/adimages`,
    {
      method: 'POST',
      body: JSON.stringify({
        url: imageUrl,
        access_token: accessToken
      })
    }
  );
  
  const data = await response.json();
  return data.images[Object.keys(data.images)[0]].hash;
}
```

### Analyzing Creative Performance

```typescript
async function getCreativeBreakdown(
  adId: string,
  accessToken: string
) {
  const insights = await fetchGraphEdges(
    accessToken,
    `${adId}/insights`,
    {
      fields: 'impressions,clicks,ctr,conversions,cost_per_conversion',
      breakdowns: 'dynamic_creative_asset', // Get per-asset performance
      date_preset: 'last_7d'
    }
  );
  
  // Group by asset type
  const assetPerformance = {
    images: insights.filter(i => i.dynamic_creative_asset?.type === 'image'),
    videos: insights.filter(i => i.dynamic_creative_asset?.type === 'video'),
    headlines: insights.filter(i => i.dynamic_creative_asset?.type === 'title'),
    primaryTexts: insights.filter(i => i.dynamic_creative_asset?.type === 'body')
  };
  
  return assetPerformance;
}
```

---

## API Version Updates (v21.0 → v22.0)

### Breaking Changes in v22.0 (Q1 2025)

1. **Removed Fields**
   - `targeting.relationship_statuses` → Use `targeting.flexible_spec` instead
   - `targeting.interested_in` → Deprecated
   - Old placement names → Use new unified placement structure

2. **New Required Fields**
   - `special_ad_categories` now required for all campaigns (can be empty array)
   - `optimization_goal` validation stricter

3. **Rate Limit Changes**
   - Ad creation: 500 → 200 per hour per account
   - Insights calls: New tiered system based on ad spend

### Migration Guide

```typescript
// Old (v20.0)
const targeting = {
  age_min: 25,
  age_max: 45,
  relationship_statuses: [1, 2] // DEPRECATED
};

// New (v21.0+)
const targeting = {
  age_min: 25,
  age_max: 45,
  flexible_spec: [
    {
      relationship_statuses: [
        { id: 1, name: 'Single' },
        { id: 2, name: 'In a relationship' }
      ]
    }
  ]
};

// Old placement structure
const placements = {
  publisher_platforms: ['facebook', 'instagram'],
  facebook_positions: ['feed', 'right_hand_column']
};

// New placement structure (v21.0+)
const placements = {
  publisher_platforms: ['facebook', 'instagram'],
  facebook_positions: ['feed', 'right_column'], // 'right_hand_column' → 'right_column'
  instagram_positions: ['stream', 'story', 'explore', 'reels']
};
```

### Version Detection

```typescript
const GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v21.0';

function getApiUrl(path: string): string {
  return `https://graph.facebook.com/${GRAPH_VERSION}/${path}`;
}

// Check if feature is available in current version
function isFeatureAvailable(feature: string): boolean {
  const features = {
    'advantage_plus': ['v19.0', 'v20.0', 'v21.0', 'v22.0'],
    'advantage_plus_creative': ['v20.0', 'v21.0', 'v22.0'],
    'reels_placement': ['v18.0', 'v19.0', 'v20.0', 'v21.0', 'v22.0']
  };
  
  return features[feature]?.includes(GRAPH_VERSION) || false;
}
```

---

## iOS 14.5+ Privacy & Attribution Changes

### Impact

1. **App Tracking Transparency (ATT)**
   - Users opt-in to tracking
   - Limited to 8 conversion events per domain
   - 24-48 hour delay in conversion reporting

2. **Aggregated Event Measurement (AEM)**
   - Priority ranking for conversion events (1-8)
   - Statistical modeling for opted-out users

### Event Priority Configuration

```typescript
interface IConversionEvent {
  eventName: string;
  priority: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8; // 1 = highest
  useForOptimization: boolean;
}

const RECOMMENDED_EVENT_PRIORITIES = {
  'Purchase': 1,           // Always highest priority
  'AddToCart': 2,
  'InitiateCheckout': 3,
  'AddPaymentInfo': 4,
  'Lead': 5,
  'CompleteRegistration': 6,
  'ViewContent': 7,
  'Search': 8
};

async function configureEventPriorities(
  pixelId: string,
  domainId: string,
  accessToken: string,
  events: IConversionEvent[]
) {
  const response = await fetch(
    `https://graph.facebook.com/v21.0/${pixelId}/shared_accounts`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        business: domainId,
        access_token: accessToken
      })
    }
  );
  
  // Configure event priorities
  for (const event of events) {
    await fetch(
      `https://graph.facebook.com/v21.0/${domainId}/server_events_business_setup`,
      {
        method: 'POST',
        body: JSON.stringify({
          event_name: event.eventName,
          priority: event.priority,
          access_token: accessToken
        })
      }
    );
  }
  
  return response.json();
}
```

### Attribution Window Updates

```typescript
// Post-iOS 14.5 attribution windows
const ATTRIBUTION_WINDOWS = {
  // Old (pre-iOS 14.5)
  old: {
    click: [1, 7, 28], // days
    view: [1, 7, 28]
  },
  // New (post-iOS 14.5)
  new: {
    click: [1, 7], // 28-day removed
    view: [1]      // 7-day and 28-day removed
  }
};

// Use appropriate attribution spec
function getAttributionSpec(iOSCompliant: boolean = true) {
  if (iOSCompliant) {
    return [
      { event_type: 'CLICK_THROUGH', window_days: 7 },
      { event_type: 'VIEW_THROUGH', window_days: 1 }
    ];
  }
  
  return [
    { event_type: 'CLICK_THROUGH', window_days: 28 },
    { event_type: 'VIEW_THROUGH', window_days: 7 }
  ];
}
```

---

## Reels Placements & Video Formats

### New Video Placements

```typescript
const REELS_PLACEMENTS = {
  facebook: ['reels', 'reels_overlay', 'video_feeds'],
  instagram: ['reels', 'reels_overlay', 'explore_reels']
};

// Video format specifications
const VIDEO_SPECS = {
  reels: {
    aspectRatio: '9:16',
    minDuration: 3,  // seconds
    maxDuration: 90,
    minResolution: { width: 540, height: 960 },
    maxFileSize: 4 * 1024 * 1024 * 1024, // 4GB
    formats: ['MP4', 'MOV']
  },
  feed: {
    aspectRatio: ['1:1', '4:5', '16:9'], // Supported aspect ratios
    minDuration: 1,
    maxDuration: 241,
    formats: ['MP4', 'MOV', 'GIF']
  },
  story: {
    aspectRatio: '9:16',
    minDuration: 1,
    maxDuration: 120,
    formats: ['MP4', 'MOV']
  }
};
```

### Creating Reels Ads

```typescript
async function createReelsAd(
  adSetId: string,
  accessToken: string,
  video: {
    url: string;
    thumbnailUrl: string;
    caption: string;
  }
) {
  const videoId = await uploadVideo(video.url, accessToken);
  
  const adResponse = await fetch(
    `https://graph.facebook.com/v21.0/act_${adAccountId}/ads`,
    {
      method: 'POST',
      body: JSON.stringify({
        name: 'Reels Ad',
        adset_id: adSetId,
        status: 'PAUSED',
        creative: {
          object_story_spec: {
            page_id: pageId,
            video_data: {
              video_id: videoId,
              image_url: video.thumbnailUrl,
              call_to_action: {
                type: 'SHOP_NOW',
                value: {
                  link: 'https://yourstore.com'
                }
              },
              message: video.caption
            }
          },
          effective_object_story_id: videoId,
          // Reels-specific
          instagram_stream: {
            video_id: videoId
          }
        },
        access_token: accessToken
      })
    }
  );
  
  return adResponse.json();
}
```

---

## Meta Verified for Business

**What:** Verification badge for businesses with enhanced features.

### Benefits

- Blue verification badge
- Impersonation protection
- Account support access
- Enhanced credibility

### API Integration

```typescript
async function checkBusinessVerificationStatus(
  businessId: string,
  accessToken: string
) {
  const business = await fetchGraphNode(
    accessToken,
    businessId,
    { fields: 'verification_status,is_verified' }
  );
  
  return {
    isVerified: business.is_verified,
    status: business.verification_status,
    eligible: business.verification_status === 'verified'
  };
}
```

---

## Messaging API Updates

### WhatsApp Business API

```typescript
interface IWhatsAppMessage {
  to: string; // Phone number
  type: 'text' | 'template' | 'interactive';
  content: {
    text?: string;
    templateName?: string;
    parameters?: Record<string, string>;
  };
}

async function sendWhatsAppMessage(
  businessPhoneId: string,
  message: IWhatsAppMessage,
  accessToken: string
) {
  const response = await fetch(
    `https://graph.facebook.com/v21.0/${businessPhoneId}/messages`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: message.to,
        type: message.type,
        text: message.content.text ? { body: message.content.text } : undefined,
        template: message.content.templateName ? {
          name: message.content.templateName,
          language: { code: 'en' },
          components: [{
            type: 'body',
            parameters: Object.entries(message.content.parameters || {}).map(
              ([key, value]) => ({ type: 'text', text: value })
            )
          }]
        } : undefined,
        access_token: accessToken
      })
    }
  );
  
  return response.json();
}
```

---

## Implementation Guide

### 1. Update API Version

```typescript
// Update environment variable
// OLD: META_GRAPH_VERSION=v20.0
// NEW: META_GRAPH_VERSION=v21.0

// Update all graph-client calls
const GRAPH_BASE_URL = `https://graph.facebook.com/${process.env.META_GRAPH_VERSION || 'v21.0'}`;
```

### 2. Migrate Campaigns to Advantage+

```typescript
async function migrateToAdvantagePlus(
  campaignId: string,
  accessToken: string
) {
  // 1. Get existing campaign
  const campaign = await fetchGraphNode(accessToken, campaignId, {
    fields: 'name,objective,status,daily_budget'
  });
  
  // 2. Create new Advantage+ campaign
  const newCampaign = await createAdvantagePlusShoppingCampaign(
    adAccountId,
    accessToken,
    {
      name: campaign.name + ' (Advantage+)',
      dailyBudget: campaign.daily_budget / 100,
      countries: ['US'],
      pixelId: 'YOUR_PIXEL_ID',
      catalogId: 'YOUR_CATALOG_ID'
    }
  );
  
  // 3. Pause old campaign
  await fetch(
    `https://graph.facebook.com/v21.0/${campaignId}`,
    {
      method: 'POST',
      body: JSON.stringify({
        status: 'PAUSED',
        access_token: accessToken
      })
    }
  );
  
  return newCampaign;
}
```

### 3. Enable Advantage+ Creative

```typescript
async function enableAdvantagePlusCreative(
  adId: string,
  accessToken: string
) {
  const response = await fetch(
    `https://graph.facebook.com/v21.0/${adId}`,
    {
      method: 'POST',
      body: JSON.stringify({
        creative: {
          degrees_of_freedom_spec: {
            creative_features_spec: {
              advantage_plus_creative: 1,
              standard_enhancements: {
                enroll_status: 'OPT_IN'
              }
            }
          }
        },
        access_token: accessToken
      })
    }
  );
  
  return response.json();
}
```

### 4. Test New Features

```typescript
async function testNewFeatures(adAccountId: string, accessToken: string) {
  // Test Advantage+ campaign creation
  console.log('Testing Advantage+ campaign...');
  const campaign = await createAdvantagePlusShoppingCampaign(
    adAccountId,
    accessToken,
    {
      name: 'Test Advantage+ Campaign',
      dailyBudget: 50,
      countries: ['US'],
      pixelId: process.env.META_PIXEL_ID!,
      catalogId: process.env.META_CATALOG_ID!
    }
  );
  console.log('✅ Advantage+ campaign created:', campaign.campaign.id);
  
  // Test Reels placement
  console.log('Testing Reels ad...');
  // ... implementation
  
  console.log('✅ All tests passed!');
}
```

---

## Migration Checklist

- [ ] Update `META_GRAPH_VERSION` to v21.0 or v22.0
- [ ] Test Advantage+ campaign creation
- [ ] Migrate targeting to new `flexible_spec` format
- [ ] Update placement structure
- [ ] Configure iOS 14.5+ event priorities
- [ ] Test Advantage+ Creative enhancements
- [ ] Add Reels placements to campaigns
- [ ] Update attribution window settings
- [ ] Test WhatsApp/Messenger integrations
- [ ] Monitor rate limits (new thresholds)
- [ ] Update error handling for deprecated fields
- [ ] Document breaking changes for team

---

## References

- [Meta Marketing API v21.0 Changelog](https://developers.facebook.com/docs/graph-api/changelog/version21.0)
- [Advantage+ Shopping Campaigns](https://www.facebook.com/business/help/600430651104551)
- [Advantage+ Creative](https://www.facebook.com/business/help/282805183041122)
- [iOS 14.5+ Changes](https://developers.facebook.com/docs/app-events/guides/aggregated-event-measurement)
- [Reels Ads Specs](https://www.facebook.com/business/help/430958302008551)
- [WhatsApp Business API](https://developers.facebook.com/docs/whatsapp/cloud-api)
