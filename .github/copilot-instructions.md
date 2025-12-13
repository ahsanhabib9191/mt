# Copilot Instructions for Meta Ads Optimization Repository

## Repository Overview

This repository contains the MongoDB + Redis database layer and initialization tooling for the Meta ads optimization stack. It provides the foundational data models, authentication middleware, security utilities, and database connectivity for an autonomous Meta/Facebook Ads campaign management system.

## Tech Stack

- **Runtime:** Node.js 20+
- **Language:** TypeScript (strict mode)
- **Database:** MongoDB with Mongoose ODM
- **Cache/Session:** Redis with ioredis
- **Authentication:** JWT with bcrypt for password hashing
- **Validation:** Zod schemas
- **Logging:** Winston with daily rotate file transport
- **Infrastructure:** Docker Compose for local development
- **CI/CD:** GitHub Actions

## Architecture Overview

This is a **database and middleware layer** for a Meta ads optimization system:

- **Multi-tenant architecture:** Each tenant has isolated data and API keys
- **Encryption at rest:** Sensitive data (OAuth tokens, API keys) encrypted using AES-256-GCM
- **Stateless authentication:** JWT tokens for API authentication
- **Rate limiting:** Redis-backed rate limiting per tenant/user
- **Audit logging:** All optimization decisions logged for compliance
- **Real-time sync:** Webhook handlers for Meta events (leads, conversions)
- **Batch processing:** Scheduled jobs for campaign optimization and reporting

The system is designed to be **imported as a library** by API servers, workers, and webhooks.

## Project Structure

```
lib/
├── db/              # Database connection and models
│   ├── client.ts    # MongoDB connection with caching
│   ├── redis.ts     # Redis client configuration
│   └── models/      # Mongoose models and schemas
├── middleware/      # Express middleware
│   ├── auth.ts      # JWT authentication
│   ├── error-handler.ts
│   └── rate-limit.ts
├── services/        # Business logic and external integrations
│   └── meta-sync/   # Meta Graph API client and sync service
├── utils/           # Utility functions
│   ├── crypto.ts    # Encryption/decryption utilities
│   ├── logger.ts    # Winston logging setup
│   ├── meta-scopes.ts
│   └── validators.ts
└── webhooks/        # Webhook handlers
    └── meta.ts      # Meta webhooks (lead forms, conversions)
scripts/             # Test and utility scripts
examples/            # Example API implementations
```

## Key Models

- **Tenant:** Multi-tenant organization/user accounts with API key management
- **MetaConnection:** Encrypted OAuth tokens and Meta Business account connections
- **AdAccount:** Meta Ad Account entities with configuration and status
- **Campaign:** Ad campaigns with budget, objective, and status tracking
- **AdSet:** Ad sets within campaigns with targeting and scheduling
- **Ad:** Individual ads with creative assets and performance metrics
- **AudienceInsight:** Audience analytics and demographic data
- **PerformanceSnapshot:** Time-series performance metrics for optimization
- **WebsiteAudit:** AI-generated website audits and recommendations
- **GeneratedCopy:** AI-generated ad copy and creative suggestions
- **CreativeAsset:** Media assets (images, videos) for ads
- **OptimizationLog:** Audit trail for automated optimization decisions

## Coding Standards

### TypeScript

- Use TypeScript strict mode; avoid `any` types
- Prefer explicit types over inference for public APIs
- Use interfaces for object shapes, types for unions/intersections
- Export types alongside implementations

### Mongoose Models

- Define schemas with explicit types using `mongoose.Schema<T>`
- Include timestamps: `{ timestamps: true }`
- Create indexes for frequently queried fields
- Use virtual properties for computed fields
- Implement `toJSON` transforms to clean up output

### Security

- **Never commit secrets** – use environment variables
- Encrypt sensitive data at rest using `lib/utils/crypto.ts`
- Hash passwords with bcrypt (cost factor 12)
- Validate all user inputs with Zod schemas
- Use JWT for stateless authentication with reasonable expiry times
- Run `npm run security:scan` before committing sensitive changes
- See `SECURITY.md` for comprehensive security guidelines

### Error Handling

- Use the centralized error handler middleware
- Throw descriptive errors with appropriate status codes
- Log errors with Winston logger including context
- Return consistent error response format

### Redis

- Use Redis for session storage, rate limiting, and caching
- Prefix keys by feature (e.g., `ratelimit:`, `session:`)
- Set appropriate TTLs on all cached data
- Handle Redis connection failures gracefully

### Logging

- Use structured logging via Winston logger in `lib/utils/logger.ts`
- Log levels: `error`, `warn`, `info`, `debug`
- Include contextual information (userId, tenantId, requestId)
- Never log sensitive data (tokens, passwords, PII)

## Development Workflow

### Local Setup

1. Copy `.env.example` to `.env`
2. Run `npm install`
3. Start services: `npm run docker:up`
4. Initialize DB: `npm run test:db`
5. Run test scripts as needed

### Environment Variables

Required variables:
- `MONGODB_URI` – MongoDB connection string
- `REDIS_URL` – Redis connection string
- `NEXTAUTH_SECRET` – JWT signing secret
- `ENCRYPTION_KEY` – 256-bit key for data encryption

### Testing

- Run test scripts: `npm run test:db`, `npm run test:security`, `npm run test:auth`, `npm run test:rate`
- Test scripts are in `scripts/` directory
- Always test database connections and encryption before deployment
- Run all tests: `npm run test:all`
- Test categories:
  - **validators:** Input validation with Zod schemas
  - **crypto-advanced:** Encryption/decryption utilities
  - **security:** Meta token encryption and API key lifecycle
  - **models:** Mongoose model validation and operations
  - **auth:** JWT authentication middleware
  - **rate:** Redis-based rate limiting
  - **redis:** Redis client connectivity
  - **error-handler:** Error handling middleware
  - **db:** Database initialization and index synchronization

### Branch Strategy

- Default branch: `mongodb-db-setup` (transitioning to `main`)
- Use short-lived feature branches: `feature/<short-name>`
- Open PRs and use squash merge
- Keep PRs small and focused

## Common Tasks

### Adding a New Model

1. Create model file in `lib/db/models/`
2. Define TypeScript interface for document type
3. Create Mongoose schema with explicit types
4. Add indexes for queries
5. Export from `lib/db/models/index.ts`
6. Update sync script if needed

### Adding Middleware

1. Create middleware file in `lib/middleware/`
2. Export Express middleware function
3. Use proper TypeScript types for req, res, next
4. Handle errors appropriately
5. Add tests in `scripts/` if needed

### Working with Services

- Services contain business logic and external API integrations
- Meta sync service (`lib/services/meta-sync/`) handles:
  - Graph API client with retry logic and rate limiting
  - Syncing campaigns, ad sets, ads, and insights from Meta
  - Bulk operations and data synchronization
- Keep services stateless and testable
- Use dependency injection for database and external clients
- Handle API errors gracefully with proper logging

### Working with Webhooks

- Webhook handlers in `lib/webhooks/` process real-time events
- Meta webhooks (`lib/webhooks/meta.ts`) handle:
  - Lead form submissions
  - Conversion events
  - Campaign updates
- Always verify webhook signatures for security
- Process webhooks asynchronously when possible
- Log all webhook events for debugging
- Return 200 OK quickly to prevent retries

### Working with Meta API

- Reference `META_ADS_OPTIMIZATION_STRATEGY.md` for business logic
- Meta API scopes are defined in `lib/utils/meta-scopes.ts`
- Store OAuth tokens encrypted in MetaConnection model
- Implement retry logic for API calls (exponential backoff)
- Respect rate limits (200 calls per hour per user, 200 per app per user)
- Use batch requests when possible to reduce API calls
- Always handle Graph API errors gracefully:
  - Error code 190: Token expired (re-authenticate)
  - Error code 17: Throttled (back off and retry)
  - Error code 100: Invalid parameter (validation error)
- Cache frequently accessed data in Redis
- Use the Meta sync service (`lib/services/meta-sync/`) for standardized API calls

## Performance Considerations

- Use MongoDB connection pooling (configured in `client.ts`)
- Implement Redis caching for frequently accessed data
- Use lean() queries when you don't need full Mongoose documents
- Create compound indexes for complex queries
- Paginate large result sets

## CI/CD

- CI runs on GitHub Actions
- Required checks: lint, typecheck, build, tests
- PRs must pass all checks before merge
- Use GitHub Actions secrets for sensitive values

## Debugging

### Common Issues

- **Connection refused errors:**
  - Ensure MongoDB and Redis containers are running: `npm run docker:up`
  - Check container health: `docker ps` or `npm run docker:logs`
  - Wait 10-20 seconds for services to initialize

- **Encryption errors:**
  - Verify `ENCRYPTION_KEY` is set and is 64 hex characters (32 bytes)
  - Check that existing tokens are properly encrypted
  - Run migration: `npm run test:security`

- **Authentication failures:**
  - Verify `JWT_SECRET` or `NEXTAUTH_SECRET` is set
  - Check token expiration and format
  - Test with: `npm run test:auth`

- **Rate limiting issues:**
  - Adjust `RATE_LIMIT_MAX` and `RATE_LIMIT_WINDOW_MS` in `.env`
  - Check Redis connection for rate limit storage
  - Test with: `npm run test:rate`

### Debugging Tools

- Use Winston logger with appropriate log levels
- Enable debug logging: `LOG_LEVEL=debug`
- Check logs directory for daily rotated log files
- Use MongoDB Compass for database inspection
- Use Redis CLI for cache/session debugging

## Documentation

- Update README.md for user-facing changes
- Update CONTRIBUTING.md for workflow changes
- Document complex business logic inline
- Keep this file updated with architectural changes

## API Examples

The `examples/api/` directory contains reference implementations for Next.js API routes:
- Campaign management (create, list, update)
- Ad set operations (CRUD operations)
- Ad management with bulk operations
- Authentication and authorization patterns
- Rate limiting and error handling
- Input validation with Zod schemas

Use these examples as templates when building new API endpoints.

## Meta Ads Optimization Context

This system implements autonomous campaign optimization based on:
- Three-phase optimization cycle (Audit → Optimize → Monitor)
- Statistical significance requirements before changes
- Learning phase protection (minimum 50 conversions)
- Emergency pause protocols for poor performance
- Automated budget reallocation based on ROAS/CPA
- Creative refresh strategies

See `META_ADS_OPTIMIZATION_STRATEGY.md` for complete strategy documentation.

## Questions or Issues?

- Check existing code patterns in `lib/` directory
- Review test scripts in `scripts/` for usage examples
- Consult CONTRIBUTING.md for workflow questions
- Refer to Mongoose, Redis, and Winston official docs for library-specific questions
