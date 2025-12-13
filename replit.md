# Shothik.ai - Meta Ads Automation Platform

## Overview
Shothik.ai is a Meta ads automation platform with AI-powered optimization. The project consists of:
- **Frontend**: React + Vite + TypeScript + Tailwind CSS dashboard (port 5000)
- **Backend API**: Express + TypeScript REST API server (port 3000)
- **Database Layer**: PostgreSQL with Drizzle ORM
- **Meta Integration**: Graph API sync, webhooks, OAuth authentication

## Project State
- **Status**: Frontend and Backend API running
- **Frontend Port**: 5000
- **Backend Port**: 3000
- **Framework**: React + Vite + TypeScript + Tailwind CSS v4

## Architecture

### Frontend (`client/`)
- `client/src/pages/` - Page components (Boost, BoostPreview, OAuthCallback)
- `client/src/remotion/` - Remotion video ad templates
- `client/src/App.tsx` - React Router routes
- `client/src/index.css` - Tailwind CSS with custom theme

### Backend API (`server/`)
- `server/index.ts` - Express server entry point
- `server/routes/campaigns.ts` - Campaign CRUD API
- `server/routes/ad-sets.ts` - Ad set management API
- `server/routes/ads.ts` - Ad management API
- `server/routes/performance.ts` - Performance analytics API
- `server/routes/auth.ts` - Meta OAuth and tenant management
- `server/routes/optimization.ts` - Optimization recommendations API
- `server/routes/webhooks.ts` - Meta webhook handlers
- `server/routes/pixels.ts` - Pixel management API
- `server/routes/capi.ts` - Conversions API (CAPI) integration
- `server/routes/boost.ts` - AI-powered campaign creation (Lexi AI-style)

### Backend Infrastructure (`lib/`)
- `lib/db/` - Database models and connection management (Mongoose/MongoDB)
- `lib/db/models/` - All Mongoose models (Tenant, Campaign, AdSet, Ad, PerformanceSnapshot, etc.)
- `lib/db/redis.ts` - Redis client configuration
- `lib/middleware/` - Express middleware (auth, rate limiting, error handling)
- `lib/services/meta-sync/` - Meta Graph API sync service
- `lib/services/meta-oauth/` - Meta OAuth service
- `lib/webhooks/` - Webhook handlers
- `lib/utils/` - Utilities (encryption, logging, validation)
- `lib/optimization/` - Ad optimization decision engine

## API Endpoints

### Campaigns
- `GET /api/campaigns` - List campaigns
- `GET /api/campaigns/:id` - Get campaign details
- `GET /api/campaigns/:id/ad-sets` - Get campaign ad sets
- `POST /api/campaigns` - Create campaign
- `PATCH /api/campaigns/:id` - Update campaign
- `DELETE /api/campaigns/:id` - Archive campaign

### Ad Sets
- `GET /api/ad-sets` - List ad sets
- `GET /api/ad-sets/:id` - Get ad set details
- `GET /api/ad-sets/:id/ads` - Get ad set ads
- `POST /api/ad-sets/:id/pause` - Pause ad set
- `POST /api/ad-sets/:id/activate` - Activate ad set

### Ads
- `GET /api/ads` - List ads
- `GET /api/ads/:id` - Get ad details
- `POST /api/ads/bulk/status` - Bulk status update
- `POST /api/ads/:id/pause` - Pause ad
- `POST /api/ads/:id/activate` - Activate ad

### Performance
- `GET /api/performance/dashboard` - Dashboard metrics
- `GET /api/performance/campaigns/:id` - Campaign performance
- `GET /api/performance/ad-sets/:id` - Ad set performance
- `GET /api/performance/ads/:id` - Ad performance
- `GET /api/performance/trends` - Performance trends

### Optimization
- `GET /api/optimization/recommendations` - Get optimization recommendations
- `POST /api/optimization/execute` - Execute optimization action
- `GET /api/optimization/logs` - View optimization history
- `GET /api/optimization/learning-phase` - Learning phase status

### Auth
- `GET /api/auth/meta/connect` - Get Meta OAuth URL
- `POST /api/auth/meta/callback` - Handle OAuth callback
- `GET /api/auth/meta/accounts` - Get user's ad accounts
- `GET /api/auth/connections` - List Meta connections
- `DELETE /api/auth/connections/:id` - Remove Meta connection
- `POST /api/auth/tenant` - Create tenant
- `GET /api/auth/tenant/:id` - Get tenant details

### Pixels
- `GET /api/pixels` - List all pixels for ad account
- `GET /api/pixels/:id` - Get pixel details
- `GET /api/pixels/:id/stats` - Get pixel event stats
- `POST /api/pixels/:id/verify` - Verify pixel installation
- `GET /api/pixels/:id/events` - Get recent pixel events

### CAPI (Conversions API)
- `GET /api/capi/status` - Check CAPI connection status
- `POST /api/capi/events` - Send conversion events to Meta
- `GET /api/capi/event-match-quality` - Get Event Match Quality score
- `POST /api/capi/test-event` - Send test event to verify setup
- `GET /api/capi/diagnostics` - Get CAPI diagnostics & errors

### Boost (AI Campaign Creation)
- `POST /api/boost/analyze` - Analyze URL and generate AI ad copy (rate limited: 5/min)
- `POST /api/boost/launch` - Launch campaign via Meta Graph API (real campaign creation)
- `GET /api/boost/drafts` - List saved draft campaigns
- `GET /api/boost/drafts/:sessionId` - Get specific draft by session ID
- `PUT /api/boost/drafts/:sessionId` - Update draft campaign
- `POST /api/boost/reach-estimate` - Get audience reach estimate from Meta API
- `POST /api/boost/pixel-analysis` - Analyze pixel maturity and get smart campaign recommendations
- `POST /api/boost/render-video` - Queue video ad render (returns job ID)
- `GET /api/boost/render-video/:jobId` - Get video render job status

### Health
- `GET /health` - Health check

## Theme Colors
- Primary: `#13ec80` (green)
- Background Dark: `#111814`
- Background Light: `#f6f8f7`
- Success: `#10B981`
- Error: `#EF4444`
- Warning: `#FFC107`

## Pages
1. **Boost** (`/` and `/boost`) - AI-powered campaign creation (Lexi AI-style URL → Ads flow)
2. **Boost Preview** (`/boost/preview`) - Preview and launch AI-generated campaigns
3. **OAuth Callback** (`/oauth-callback`) - Meta OAuth callback handler

## Environment Variables
Set these in `.env` or Replit Secrets:
- `DATABASE_URL` - PostgreSQL connection string (auto-configured by Replit)
- `ENCRYPTION_KEY` - 32-byte key for AES-256-GCM encryption
- `NEXTAUTH_SECRET` - JWT authentication secret
- `META_APP_ID`, `META_APP_SECRET` - Facebook/Meta app credentials
- `META_REDIRECT_URI` - OAuth redirect URI
- `META_API_VERSION` - Graph API version (default: v21.0)

## Running the App
- **Frontend**: `cd client && npm run dev` (port 5000)
- **Backend**: `npx ts-node server/index.ts` (port 3000)

## Database Models
- **Campaign** - Facebook ad campaigns
- **AdSet** - Campaign ad sets with targeting and learning phase
- **Ad** - Individual ads with creative info
- **PerformanceSnapshot** - Daily performance metrics
- **OptimizationLog** - Audit trail of optimization actions
- **MetaConnection** - OAuth tokens (encrypted)
- **Tenant** - Multi-tenant support

## Optimization Engine
The optimization engine in `lib/optimization/` provides:
- Learning phase protection (50-event threshold)
- Pause logic (high CPA, low CTR, high frequency)
- Scaling logic (ROAS > 3x triggers 20% budget increase)
- Creative fatigue detection
- Statistical confidence intervals (Wilson score)

## Database
- **PostgreSQL** with Drizzle ORM (auto-configured by Replit)
- Schema defined in `shared/schema.ts`
- Push schema changes: `npm run db:push`
- View database: `npm run db:studio`

## Boost Feature (AI Campaign Creation)
The Boost feature provides a Lexi AI-style campaign creation flow:

**Magic Flow:**
1. URL Input → User enters website URL
2. Analyzing → Animated scanning with progress bar
3. Results → Shows brand colors, USP, page speed, pixel detection, images
4. Creative → Pick headline, primary text, CTA from AI-generated options
5. Targeting → AI-suggested interests, age, gender (lookalikes locked until FB connect)
6. Budget → Daily budget slider, duration picker, estimated reach
7. Preview → Facebook and Instagram ad mockups
8. Launch → Connect Facebook to publish

**Backend Intelligence:**
- Brand color extraction from CSS/HTML
- Page speed measurement
- Meta pixel detection (fbq() calls)
- USP extraction from meta descriptions and h1 tags
- Hook library with 50+ proven ad hooks
- Tone matching for copy generation

**User Types Supported:**
- Newbie: New to Facebook ads, needs awareness campaigns
- Growing: Has some data, ready for engagement campaigns
- Pro: Mature pixel, needs sales/lookalike targeting

## Remotion Video Ad Generation
The platform uses Remotion for programmatic video ad creation, supporting Meta's Andromeda requirement for diverse creative formats.

### Video Templates (`client/src/remotion/templates/`)
1. **ProductShowcase** - Zoom/pan animation on product image with headline overlay
2. **PriceDrop** - Animated price slash effect with strikethrough
3. **Testimonial** - Customer quote overlay with gradient background

### Video Composition Settings
- Resolution: 1080x1080 (square for feed)
- FPS: 30
- Duration: 4-6 seconds (120-180 frames)

### Integration
- **Preview**: @remotion/player for in-browser preview
- **Render**: @remotion/renderer for server-side MP4 generation (future)
- **Format selector**: Toggle between Image Ad / Video Ad in Boost creative step

## Notes
- Backend uses PostgreSQL with Drizzle ORM for all data operations
- Frontend uses Tailwind CSS v4 with @theme directives
- Dark mode is enabled by default
- Meta OAuth requires app credentials to be configured
- OpenAI integration uses Replit AI Integrations (no API key needed)
