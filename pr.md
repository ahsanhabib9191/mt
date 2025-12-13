# DB & Middleware: Mongo/Redis setup, encryption, auth, rate limiting, tests, and migration

This PR introduces the database and middleware foundation for the Meta ads optimization stack.

Highlights

- Database & Infra
  - MongoDB/Mongoose with index drop+sync on init, connection caching, Docker Compose for MongoDB 6 and Redis 7
  - Redis client for rate limiting
- Utilities & Security
  - AES-256-GCM encryption for Meta tokens (encrypt on save/update)
  - Winston logger with daily rotation; Zod validators; Meta scopes helpers
- Middleware
  - Auth: JWT verification (NEXTAUTH_SECRET), API key verification via Tenant.apiKeyHash, requireAuth wrapper
  - Rate limiting: Redis sliding window by IP/tenant/api key
  - Central error handler
- Models
  - MetaConnection: encrypted tokens, status field, indexes
  - Tenant: apiKeyHash, requestCounts, issue/verify API key helpers
- Migration & Tests
  - scripts/encrypt-existing-tokens.ts (dry vs live)
  - scripts/test-encryption.ts (encryption + API key lifecycle)
  - scripts/test-auth.ts (verifyAuth, requireAuth, verifyApiKey)
  - scripts/test-rate-limit.ts (window behavior, edge cases)
- README & Scripts
  - Docs for migration and tests; npm scripts: test:security, test:auth, test:rate

How to run

1) npm install
2) npm run docker:up
3) export NEXTAUTH_SECRET="dev-secret"
4) export ENCRYPTION_KEY="$(node -e "crypto=require('crypto');console.log(crypto.randomBytes(32).toString('hex'))")"
5) npm run test:security && npm run test:auth && npm run test:rate

Status: Build + typecheck green; tests pass locally.
Follow-ups: add CI workflow and integrate with Next.js API routes.
