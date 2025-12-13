# AI-Powered Ad Copy Generation Guide

This guide explains how to implement AI-powered ad copy generation for Meta Ads using this database layer with OpenAI, Claude, or other LLM providers.

> **Note:** This repository provides the data models and storage. You'll need to integrate with an AI provider (OpenAI, Anthropic Claude, etc.) separately.

## Table of Contents

1. [Overview](#overview)
2. [Database Models](#database-models)
3. [AI Provider Integration](#ai-provider-integration)
4. [Copy Generation Strategies](#copy-generation-strategies)
5. [Creative Management](#creative-management)
6. [A/B Testing Copy Variants](#ab-testing-copy-variants)
7. [Quality Scoring](#quality-scoring)
8. [Best Practices](#best-practices)

---

## Overview

The system uses the `GeneratedCopy` model to store AI-generated ad copy and track its usage across campaigns, ad sets, and ads.

### Copy Generation Flow

```
Business Context + Product Info
    ↓
AI Model (GPT-4, Claude, etc.)
    ↓
Generated Copy Variants
    ↓
Store in GeneratedCopy model
    ↓
Use in Ad creative
    ↓
Track performance & iterate
```

---

## Database Models

### GeneratedCopy Model

```typescript
import { GeneratedCopyModel, IGeneratedCopy } from '@your-org/meta-ad-db/lib/db/models/GeneratedCopy';

interface IGeneratedCopy {
  tenantId: string;
  context: 'AD' | 'LANDING_PAGE' | 'EMAIL' | 'SOCIAL_POST' | 'UNKNOWN';
  inputBrief: string;      // User's input/prompt
  outputText: string;      // AI-generated text
  model?: string;          // e.g., 'gpt-4o', 'claude-3-opus', 'gpt-4-turbo'
  qualityScore?: number;   // 0-100 quality rating
  tags?: string[];         // e.g., ['holiday', 'discount', 'urgency']
  usedBy?: Array<{
    entityType: 'CAMPAIGN' | 'AD_SET' | 'AD';
    entityId: string;
  }>;
  createdAt?: Date;
  updatedAt?: Date;
}
```

### CreativeAsset Model

```typescript
import { CreativeAssetModel, ICreativeAsset } from '@your-org/meta-ad-db/lib/db/models/creative-asset';

interface ICreativeAsset {
  assetId: string;
  type: 'IMAGE' | 'VIDEO' | 'CAROUSEL' | 'TEXT' | 'UNKNOWN';
  url: string;
  hash?: string;           // Content hash for deduplication
  metadata?: {
    headline?: string;
    primaryText?: string;
    description?: string;
    callToAction?: string;
    dimensions?: { width: number; height: number };
  };
  usedBy: Array<{
    entityType: 'CAMPAIGN' | 'AD_SET' | 'AD';
    entityId: string;
  }>;
}
```

---

## AI Provider Integration

### OpenAI Integration

```typescript
import OpenAI from 'openai';
import { GeneratedCopy } from '@your-org/meta-ad-db/lib/db/models/GeneratedCopy';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function generateAdCopyWithOpenAI(
  tenantId: string,
  productInfo: {
    name: string;
    description: string;
    targetAudience: string;
    keyBenefits: string[];
    tone: 'professional' | 'casual' | 'urgent' | 'friendly';
  },
  variants: number = 3
) {
  const prompt = `You are an expert Meta Ads copywriter. Generate ${variants} high-converting ad copy variants.

Product: ${productInfo.name}
Description: ${productInfo.description}
Target Audience: ${productInfo.targetAudience}
Key Benefits: ${productInfo.keyBenefits.join(', ')}
Tone: ${productInfo.tone}

For each variant, provide:
1. Primary Text (max 125 characters, attention-grabbing)
2. Headline (max 40 characters, clear value prop)
3. Description (max 30 characters, call-to-action)

Format as JSON array with structure: [{ primaryText, headline, description }]`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: 'You are an expert Meta Ads copywriter focused on high conversion rates.'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    temperature: 0.8,
    response_format: { type: 'json_object' }
  });

  const copyVariants = JSON.parse(response.choices[0].message.content || '{}');
  
  // Store each variant in database
  const savedCopies = [];
  for (const variant of copyVariants.variants || []) {
    const copy = await GeneratedCopy.create({
      tenantId,
      context: 'AD',
      inputBrief: JSON.stringify(productInfo),
      outputText: JSON.stringify(variant),
      model: 'gpt-4o',
      tags: [productInfo.tone, 'ai-generated', new Date().toISOString().split('T')[0]]
    });
    savedCopies.push(copy);
  }
  
  return savedCopies;
}
```

### Anthropic Claude Integration

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { GeneratedCopy } from '@your-org/meta-ad-db/lib/db/models/GeneratedCopy';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

async function generateAdCopyWithClaude(
  tenantId: string,
  productInfo: {
    name: string;
    description: string;
    targetAudience: string;
    keyBenefits: string[];
    tone: string;
  },
  variants: number = 3
) {
  const prompt = `Generate ${variants} Meta/Facebook ad copy variants for this product.

Product: ${productInfo.name}
Description: ${productInfo.description}
Target Audience: ${productInfo.targetAudience}
Key Benefits: ${productInfo.keyBenefits.join(', ')}
Desired Tone: ${productInfo.tone}

Requirements:
- Primary Text: Max 125 characters, hook the reader immediately
- Headline: Max 40 characters, clear value proposition
- Description: Max 30 characters, strong CTA

Return as JSON: { "variants": [{ "primaryText": "...", "headline": "...", "description": "..." }] }`;

  const message = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: prompt
      }
    ]
  });

  const content = message.content[0].type === 'text' ? message.content[0].text : '{}';
  const copyVariants = JSON.parse(content);
  
  const savedCopies = [];
  for (const variant of copyVariants.variants || []) {
    const copy = await GeneratedCopy.create({
      tenantId,
      context: 'AD',
      inputBrief: JSON.stringify(productInfo),
      outputText: JSON.stringify(variant),
      model: 'claude-3-5-sonnet-20241022',
      tags: [productInfo.tone, 'ai-generated']
    });
    savedCopies.push(copy);
  }
  
  return savedCopies;
}
```

---

## Copy Generation Strategies

### 1. Product-Focused Copy

```typescript
async function generateProductFocusedCopy(
  tenantId: string,
  product: {
    name: string;
    price: number;
    discount?: number;
    features: string[];
    category: string;
  }
) {
  const discountText = product.discount 
    ? `${product.discount}% OFF - ` 
    : '';
  
  const prompt = `Create 5 ad copy variants for this product:
${product.name} - $${product.price}
${discountText}Category: ${product.category}
Features: ${product.features.join(', ')}

Focus on:
1. Benefit-driven headlines
2. Scarcity/urgency where appropriate
3. Clear CTAs
4. Social proof suggestions`;

  // Use your AI provider
  const copies = await generateAdCopyWithOpenAI(tenantId, {
    name: product.name,
    description: `$${product.price} ${product.category}`,
    targetAudience: 'Users interested in ' + product.category,
    keyBenefits: product.features,
    tone: product.discount ? 'urgent' : 'professional'
  }, 5);
  
  return copies;
}
```

### 2. Audience-Targeted Copy

```typescript
async function generateAudienceTargetedCopy(
  tenantId: string,
  audienceSegment: {
    demographics: { ageRange: string; gender?: string };
    interests: string[];
    painPoints: string[];
  },
  product: any
) {
  const prompt = `Create ad copy targeting:
Age: ${audienceSegment.demographics.ageRange}
${audienceSegment.demographics.gender ? 'Gender: ' + audienceSegment.demographics.gender : ''}
Interests: ${audienceSegment.interests.join(', ')}
Pain Points: ${audienceSegment.painPoints.join(', ')}

Product: ${product.name}
Solution: How this product solves their pain points

Create 3 variants speaking directly to this audience.`;

  // Generate copy addressing specific audience needs
  const copies = await generateAdCopyWithOpenAI(tenantId, {
    name: product.name,
    description: product.description,
    targetAudience: `${audienceSegment.demographics.ageRange} ${audienceSegment.demographics.gender || ''} interested in ${audienceSegment.interests[0]}`,
    keyBenefits: audienceSegment.painPoints.map(pain => `Solves: ${pain}`),
    tone: 'friendly'
  }, 3);
  
  return copies;
}
```

### 3. Campaign-Specific Copy

```typescript
async function generateCampaignCopy(
  tenantId: string,
  campaign: {
    objective: 'AWARENESS' | 'CONSIDERATION' | 'CONVERSION';
    theme: string;
    seasonality?: string;
  },
  product: any
) {
  const objectivePrompts = {
    AWARENESS: 'Focus on brand story, education, introducing the product',
    CONSIDERATION: 'Emphasize features, comparisons, reviews, social proof',
    CONVERSION: 'Strong CTAs, urgency, limited offers, clear next steps'
  };
  
  const prompt = `Campaign Objective: ${campaign.objective}
${objectivePrompts[campaign.objective]}

Theme: ${campaign.theme}
${campaign.seasonality ? 'Seasonality: ' + campaign.seasonality : ''}

Product: ${product.name}

Create 4 variants optimized for ${campaign.objective}.`;

  const tone = campaign.objective === 'CONVERSION' ? 'urgent' : 
                campaign.objective === 'CONSIDERATION' ? 'professional' : 'friendly';
  
  const copies = await generateAdCopyWithOpenAI(tenantId, {
    name: product.name,
    description: product.description + ' - ' + campaign.theme,
    targetAudience: 'Target audience for ' + campaign.objective.toLowerCase(),
    keyBenefits: product.keyBenefits || [],
    tone
  }, 4);
  
  return copies;
}
```

### 4. Retargeting Copy

```typescript
async function generateRetargetingCopy(
  tenantId: string,
  userAction: 'viewed_product' | 'added_to_cart' | 'initiated_checkout' | 'abandoned_cart',
  product: any
) {
  const retargetingMessages = {
    viewed_product: 'Remind them of what they saw, add social proof',
    added_to_cart: 'Create urgency, offer small discount, remind of cart',
    initiated_checkout: 'Remove friction, offer support, guarantee trust',
    abandoned_cart: 'Strong urgency, limited-time discount, scarcity'
  };
  
  const prompt = `User Action: ${userAction}
Strategy: ${retargetingMessages[userAction]}

Product they interacted with: ${product.name}

Create 3 retargeting ad variants that:
1. Acknowledge their previous interest
2. Provide new incentive to return
3. Remove objections
4. Create urgency`;

  const tone = userAction.includes('abandoned') || userAction.includes('checkout') 
    ? 'urgent' : 'friendly';
  
  const copies = await generateAdCopyWithOpenAI(tenantId, {
    name: product.name,
    description: `Retargeting: ${userAction}`,
    targetAudience: 'Users who ' + userAction.replace('_', ' '),
    keyBenefits: ['Come back', 'Limited time', 'Special offer'],
    tone
  }, 3);
  
  return copies;
}
```

---

## Creative Management

### Creating Complete Ad Creative

```typescript
import { AdModel } from '@your-org/meta-ad-db/lib/db/models/ad';
import { CreativeAssetModel } from '@your-org/meta-ad-db/lib/db/models/creative-asset';

async function createAdWithGeneratedCopy(
  adSetId: string,
  campaignId: string,
  accountId: string,
  generatedCopyId: string,
  imageUrl: string
) {
  // Get the generated copy
  const generatedCopy = await GeneratedCopyModel.findById(generatedCopyId);
  if (!generatedCopy) throw new Error('Generated copy not found');
  
  const copyData = JSON.parse(generatedCopy.outputText);
  
  // Create or find creative asset
  let creativeAsset = await CreativeAssetModel.findOne({ url: imageUrl });
  if (!creativeAsset) {
    creativeAsset = await CreativeAssetModel.create({
      assetId: 'asset_' + Date.now(),
      type: 'IMAGE',
      url: imageUrl,
      metadata: {
        headline: copyData.headline,
        primaryText: copyData.primaryText,
        description: copyData.description
      },
      usedBy: []
    });
  }
  
  // Create ad
  const ad = await AdModel.create({
    adId: 'ad_' + Date.now(),
    adSetId,
    campaignId,
    accountId,
    name: copyData.headline + ' - ' + new Date().toISOString().split('T')[0],
    status: 'DRAFT',
    creative: {
      creativeId: creativeAsset.assetId,
      type: 'IMAGE',
      headline: copyData.headline,
      body: copyData.primaryText,
      callToAction: copyData.description,
      linkUrl: process.env.LANDING_PAGE_URL
    },
    effectiveStatus: 'PAUSED',
    issues: []
  });
  
  // Update usage tracking
  await GeneratedCopyModel.findByIdAndUpdate(
    generatedCopyId,
    { $push: { usedBy: { entityType: 'AD', entityId: ad.adId } } }
  );
  
  await CreativeAssetModel.findByIdAndUpdate(
    creativeAsset._id,
    { $push: { usedBy: { entityType: 'AD', entityId: ad.adId } } }
  );
  
  return ad;
}
```

### Bulk Copy Generation for Testing

```typescript
async function generateCopyVariantsForTesting(
  tenantId: string,
  product: any,
  numberOfVariants: number = 10
) {
  const variations = {
    tones: ['professional', 'casual', 'urgent', 'friendly'],
    angles: ['benefit', 'problem-solution', 'social-proof', 'scarcity'],
    ctas: ['Shop Now', 'Learn More', 'Get Started', 'Claim Offer']
  };
  
  const allCopies = [];
  
  for (let i = 0; i < numberOfVariants; i++) {
    const tone = variations.tones[i % variations.tones.length];
    const angle = variations.angles[Math.floor(i / variations.tones.length) % variations.angles.length];
    
    const copies = await generateAdCopyWithOpenAI(tenantId, {
      name: product.name,
      description: `${product.description} (Angle: ${angle})`,
      targetAudience: product.targetAudience,
      keyBenefits: product.keyBenefits,
      tone: tone as any
    }, 1);
    
    allCopies.push(...copies);
  }
  
  return allCopies;
}
```

---

## A/B Testing Copy Variants

### Setting Up Copy Tests

```typescript
interface ICopyTest {
  testName: string;
  variants: Array<{
    copyId: string;
    adId: string;
    budget: number;
  }>;
  metric: 'CTR' | 'CPC' | 'ROAS' | 'CONVERSIONS';
  startDate: Date;
  duration: number; // days
}

async function setupCopyABTest(
  tenantId: string,
  adSetId: string,
  campaignId: string,
  accountId: string,
  generatedCopyIds: string[],
  budgetPerVariant: number
): Promise<ICopyTest> {
  const variants = [];
  
  for (const copyId of generatedCopyIds) {
    const ad = await createAdWithGeneratedCopy(
      adSetId,
      campaignId,
      accountId,
      copyId,
      'https://example.com/product-image.jpg' // Your image URL
    );
    
    variants.push({
      copyId,
      adId: ad.adId,
      budget: budgetPerVariant
    });
  }
  
  return {
    testName: `Copy Test ${new Date().toISOString()}`,
    variants,
    metric: 'CTR',
    startDate: new Date(),
    duration: 7
  };
}
```

### Analyzing Test Results

```typescript
import { fetchGraphNode } from '@your-org/meta-ad-db/lib/services/meta-sync/graph-client';

async function analyzeCopyTestResults(
  test: ICopyTest,
  accessToken: string
) {
  const results = [];
  
  for (const variant of test.variants) {
    const insights = await fetchGraphNode(
      accessToken,
      `${variant.adId}/insights`,
      {
        fields: 'impressions,clicks,ctr,cpc,spend,conversions,cost_per_conversion',
        date_preset: 'last_7d'
      }
    );
    
    const copy = await GeneratedCopyModel.findById(variant.copyId);
    
    results.push({
      copyId: variant.copyId,
      adId: variant.adId,
      copyPreview: copy ? JSON.parse(copy.outputText).headline : 'Unknown',
      metrics: insights,
      performanceScore: calculatePerformanceScore(insights)
    });
  }
  
  // Sort by performance
  results.sort((a, b) => b.performanceScore - a.performanceScore);
  
  return {
    testName: test.testName,
    winner: results[0],
    allResults: results,
    recommendation: results.length >= 2 && results[0].performanceScore > results[1].performanceScore * 1.2
      ? 'Clear winner - scale this copy'
      : results.length < 2
      ? 'Need at least 2 variants to compare'
      : 'Results inconclusive - continue testing'
  };
}

const DEFAULT_HIGH_CPC = 999; // Fallback for missing CPC data (penalizes in score calculation)

function calculatePerformanceScore(insights: any): number {
  const ctr = parseFloat(insights.ctr || 0);
  const conversions = parseInt(insights.conversions || 0);
  const cpc = parseFloat(insights.cpc || DEFAULT_HIGH_CPC);
  
  // Weighted score: CTR (40%), Conversions (40%), CPC (20%)
  return (ctr * 40) + (conversions * 4) + ((1 / cpc) * 20);
}
```

---

## Quality Scoring

### Automated Copy Quality Scoring

```typescript
async function scoreGeneratedCopy(copyId: string): Promise<number> {
  const copy = await GeneratedCopyModel.findById(copyId);
  if (!copy) return 0;
  
  const copyData = JSON.parse(copy.outputText);
  let score = 0;
  
  // Character length checks (Meta best practices)
  if (copyData.primaryText && copyData.primaryText.length <= 125) score += 20;
  if (copyData.headline && copyData.headline.length <= 40) score += 20;
  if (copyData.description && copyData.description.length <= 30) score += 20;
  
  // Content quality checks
  if (copyData.primaryText) {
    const text = copyData.primaryText.toLowerCase();
    
    // Has emoji or attention grabber
    if (/[🎉🔥💡✨⭐👉💰🎁]/.test(text) || /[!?]/.test(text)) score += 10;
    
    // Has numbers/stats (credibility)
    if (/\d+%|\d+ [a-z]+/.test(text)) score += 5;
    
    // Has power words
    const powerWords = ['free', 'save', 'new', 'proven', 'guarantee', 'limited'];
    if (powerWords.some(word => text.includes(word))) score += 10;
    
    // Has clear CTA
    const ctas = ['shop now', 'learn more', 'get started', 'buy now', 'sign up'];
    if (ctas.some(cta => text.includes(cta))) score += 15;
  }
  
  // Update score in database
  await GeneratedCopyModel.findByIdAndUpdate(copyId, { qualityScore: score });
  
  return score;
}

async function batchScoreCopies(tenantId: string): Promise<void> {
  const copies = await GeneratedCopyModel.find({ 
    tenantId, 
    qualityScore: { $exists: false } 
  });
  
  for (const copy of copies) {
    await scoreGeneratedCopy(copy._id.toString());
  }
  
  console.log(`Scored ${copies.length} copies`);
}
```

---

## Best Practices

### 1. Copy Generation Guidelines

**DO:**
- ✅ Generate multiple variants (5-10) for A/B testing
- ✅ Include character limits in prompts (Meta's limits)
- ✅ Test different tones and angles
- ✅ Use product benefits, not just features
- ✅ Include social proof when available
- ✅ Create urgency appropriately (limited time, stock)
- ✅ Tag copies for easy filtering (tone, theme, season)

**DON'T:**
- ❌ Generate only 1-2 variants
- ❌ Ignore platform character limits
- ❌ Use misleading claims
- ❌ Overuse urgency/scarcity
- ❌ Forget to store input brief for iteration
- ❌ Skip A/B testing

### 2. Creative Refresh Strategy

Based on the Meta Ads Optimization Strategy document:

```typescript
async function shouldRefreshCreative(adId: string, accessToken: string): Promise<boolean> {
  const insights = await fetchGraphNode(
    accessToken,
    `${adId}/insights`,
    { fields: 'frequency,ctr,spend', date_preset: 'last_7d' }
  );
  
  const frequency = parseFloat(insights.frequency || 0);
  const ctr = parseFloat(insights.ctr || 0);
  const spend = parseFloat(insights.spend || 0);
  
  // Refresh needed if:
  // - Frequency > 3.0 (audience fatigue)
  // - CTR < 0.5% (poor creative)
  // - Spend > $500 with declining CTR
  return frequency > 3.0 || ctr < 0.5 || (spend > 500 && ctr < 1.0);
}

async function refreshAdCreative(
  adId: string,
  tenantId: string,
  product: any
) {
  // Generate new copy variants
  const newCopies = await generateAdCopyWithOpenAI(tenantId, product, 3);
  
  // Create new ads with fresh creative
  const ad = await AdModel.findOne({ adId });
  if (!ad) return;
  
  const newAds = [];
  for (const copy of newCopies) {
    const newAd = await createAdWithGeneratedCopy(
      ad.adSetId,
      ad.campaignId,
      ad.accountId,
      copy._id.toString(),
      'https://example.com/new-product-image.jpg'
    );
    newAds.push(newAd);
  }
  
  // Pause old ad
  await AdModel.findOneAndUpdate(
    { adId },
    { status: 'PAUSED', effectiveStatus: 'PAUSED' }
  );
  
  return newAds;
}
```

### 3. Model Selection Guide

| Model | Best For | Cost | Speed | Quality |
|-------|----------|------|-------|---------|
| **GPT-4o** | Production, high quality | Medium | Fast | Excellent |
| **GPT-4 Turbo** | Complex copy, long form | High | Medium | Excellent |
| **GPT-3.5 Turbo** | Bulk generation, testing | Low | Very Fast | Good |
| **Claude 3.5 Sonnet** | Creative copy, brand voice | Medium | Fast | Excellent |
| **Claude 3 Opus** | Premium campaigns | High | Slow | Outstanding |
| **Claude 3 Haiku** | High-volume, simple copy | Low | Very Fast | Good |

### 4. Prompt Engineering Tips

```typescript
const EFFECTIVE_PROMPTS = {
  // Specific and constrained
  good: `Create 3 Meta ad headlines (max 40 chars each) for [product] targeting [audience]. 
         Focus on [benefit]. Tone: [tone]. Include: 
         1. Emotional hook
         2. Clear value prop
         3. Strong CTA`,
  
  // Too vague
  bad: `Write some ad copy for my product`,
  
  // With examples (few-shot learning)
  withExamples: `Create Meta ad copy like these winning examples:
                 Example 1: "Save 40% Today! 🎉 Premium Quality, Half the Price"
                 Example 2: "Join 10,000+ Happy Customers - Free Shipping"
                 
                 Now create 5 similar variants for [your product]`
};
```

### 5. Performance Optimization

```typescript
// Cache frequently used prompts
const PROMPT_CACHE: Map<string, any> = new Map();

async function generateWithCache(key: string, generator: () => Promise<any>) {
  if (PROMPT_CACHE.has(key)) {
    return PROMPT_CACHE.get(key);
  }
  
  const result = await generator();
  PROMPT_CACHE.set(key, result);
  
  // Clear cache after 1 hour
  setTimeout(() => PROMPT_CACHE.delete(key), 3600000);
  
  return result;
}

// Batch API calls
async function generateMultipleCopiesBatch(
  tenantId: string,
  products: any[]
) {
  // Instead of sequential API calls, batch them
  const promises = products.map(product => 
    generateAdCopyWithOpenAI(tenantId, product, 3)
  );
  
  return Promise.all(promises);
}
```

---

## Example: Complete Implementation

```typescript
// app/api/generate-copy/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { initializeDatabase } from '@your-org/meta-ad-db/lib/db';
import { generateAdCopyWithOpenAI } from './copy-generator';

export async function POST(request: NextRequest) {
  await initializeDatabase();
  
  const body = await request.json();
  const { tenantId, product, variants = 5 } = body;
  
  try {
    // Generate copies
    const copies = await generateAdCopyWithOpenAI(tenantId, product, variants);
    
    // Score each copy
    for (const copy of copies) {
      await scoreGeneratedCopy(copy._id.toString());
    }
    
    // Return sorted by quality score
    const scoredCopies = await GeneratedCopyModel
      .find({ _id: { $in: copies.map(c => c._id) } })
      .sort({ qualityScore: -1 });
    
    return NextResponse.json({
      success: true,
      copies: scoredCopies.map(c => ({
        id: c._id,
        copy: JSON.parse(c.outputText),
        qualityScore: c.qualityScore,
        model: c.model
      }))
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to generate copy', details: error.message },
      { status: 500 }
    );
  }
}
```

---

## References

- [Meta Ad Copy Best Practices](https://www.facebook.com/business/ads/ad-copy)
- [OpenAI API Documentation](https://platform.openai.com/docs)
- [Anthropic Claude API](https://docs.anthropic.com/)
- [Creative Refresh Strategy](../META_ADS_OPTIMIZATION_STRATEGY.md#creative-refresh-strategy)
