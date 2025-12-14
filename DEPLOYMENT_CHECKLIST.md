# 🚀 Pre-Deployment Checklist

## Local Development Verification

### TypeScript & Build

- [x] `npm run build` compiles successfully
- [x] No TypeScript errors or warnings
- [x] All dependencies installed (`npm install`)
- [x] Node modules include: tsconfig-paths, nodemon (for MCP dev)

### Environment & Secrets

- [ ] Copy `.env.example` to `.env`
- [ ] Generate secure keys:
  - `ENCRYPTION_KEY` (32 bytes / 64 hex chars): `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
  - `NEXTAUTH_SECRET` (64+ bytes): `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`
- [ ] Set `MONGODB_URI` (production connection)
- [ ] Set `REDIS_URL` (production connection)
- [ ] (Optional) Set `META_APP_ID` and `META_APP_SECRET` for real Meta integration
- [ ] Verify no secrets committed to git (`git log --all --source --full-history -- '*' | grep -i secret`)

### Core Services

- [ ] Start MongoDB: `docker compose -f docker-compose.prod.yml up -d mongo`
- [ ] Start Redis: `docker compose -f docker-compose.prod.yml up -d redis`
- [ ] Verify MongoDB health: `docker compose -f docker-compose.prod.yml exec mongo mongosh --eval "db.runCommand({ ping: 1 })"`
- [ ] Verify Redis health: `docker compose -f docker-compose.prod.yml exec redis redis-cli ping`

### API Server Tests

- [x] `npm run test:validators` - Input validation with Zod
- [x] `npm run test:crypto-advanced` - Encryption/decryption
- [x] `npm run test:security` - Security utilities
- [x] `npm run test:models` - Mongoose models
- [x] `npm run test:auth` - JWT authentication
- [x] `npm run test:rate` - Rate limiting
- [x] `npm run test:redis` - Redis connectivity
- [x] `npm run test:error-handler` - Error handling middleware
- [x] `npm run test:db` - Database initialization
- [x] `npm run test:mcp` - Local MCP server (optional)

### API Health

- [ ] Start API server: `npm run build && npm start`
- [ ] Verify health endpoint: `curl -s http://localhost:3000/health | jq`
- [ ] Check logs for startup errors
- [ ] Verify `CORS_ORIGIN` is set to concrete domain (not `*`)
- [ ] Verify `OPTIMIZATION_MODE` is set (`MONITOR` or `ACTIVE`)

### MCP Server (Local Development)

- [ ] `npm run mcp:start` starts without errors
- [ ] `curl -s http://localhost:5005/health` returns ok
- [ ] `MCP_PORT` is set in `.env` (default 5005)
- [ ] (Optional) `MCP_API_KEY` is set if authentication required
- [ ] (Optional) `MCP_CORS_ORIGIN` is set if browser access needed

### Client Build

- [ ] `cd client && npm install && npm run build` succeeds
- [ ] No build errors or warnings
- [ ] Static assets generated in `client/dist/`

---

## Production Docker Deployment

### Pre-Deployment

- [ ] Update `.env` with production secrets (use env var injection, not committed values)
- [ ] Set `NODE_ENV=production`
- [ ] Set `LOG_LEVEL=info` or `warn`
- [ ] Review `docker-compose.prod.yml` for environment overrides
- [ ] Ensure healthchecks use correct commands (mongo: `mongosh`, redis: `redis-cli`)

### Build & Deploy

- [ ] `docker compose -f docker-compose.prod.yml build` succeeds
- [ ] `docker compose -f docker-compose.prod.yml up -d` starts all services
- [ ] Wait 20-30 seconds for services to initialize

### Post-Deployment Verification

- [ ] `docker compose -f docker-compose.prod.yml ps` shows all services healthy (6 containers)
- [ ] Check service logs: `docker compose -f docker-compose.prod.yml logs -f api_server`
- [ ] API health: `curl -s http://localhost:3000/health | jq`
- [ ] MongoDB ping: `docker compose -f docker-compose.prod.yml exec mongo mongosh --eval "db.runCommand({ ping: 1 })"`
- [ ] Redis ping: `docker compose -f docker-compose.prod.yml exec redis redis-cli ping`
- [ ] Dashboard accessible: [http://localhost:8080](http://localhost:8080)
- [ ] Check for startup errors in logs (no MISSING/INVALID env var messages)

### Container Health

- [ ] mongo (meta_mongo) - healthy
- [ ] redis (meta_redis) - healthy
- [ ] api_server (meta_api) - healthy / running
- [ ] worker (meta_worker) - healthy / running
- [ ] optimizer (meta_optimizer) - healthy / running
- [ ] client (meta_client) - healthy / running

---

## Security & Compliance

### Secrets Management

- [ ] No hardcoded API keys, tokens, or passwords in code
- [ ] All sensitive data in `.env` or environment variables
- [ ] `ENCRYPTION_KEY` is 64 hex chars (32 bytes)
- [ ] `NEXTAUTH_SECRET` is strong (64+ bytes)
- [ ] Run `npm run security:scan` before commit

### CORS & Headers

- [ ] `CORS_ORIGIN` set to concrete domain (e.g., `https://yourdomain.com`)
- [ ] Not set to `*` in production
- [ ] `helmet()` middleware enabled (security headers)
- [ ] `DEPLOYMENT_GUIDE.md` documents CORS guidance

### Rate Limiting

- [ ] Rate limiting enabled: `RATE_LIMIT_ENABLED=true`
- [ ] Rate limit window: `RATE_LIMIT_WINDOW_MS=900000` (15 min)
- [ ] Rate limit max: `RATE_LIMIT_MAX_REQUESTS=100` (per window)
- [ ] Redis available for rate limit storage

### Mock vs Real Mode

- [ ] Decision made: Mock Mode (`META_APP_ID`/`META_APP_SECRET` blank) vs Real (both set)
- [ ] If Real: `OPTIMIZATION_MODE=MONITOR` for observation-only (recommended first)
- [ ] If Real: Document approval for real ad spend
- [ ] Warning logged if Real mode + ACTIVE optimization

---

## Monitoring & Logging

### Logging Setup

- [ ] Winston logger configured in `lib/utils/logger.ts`
- [ ] Log level set appropriately (debug for dev, info/warn for prod)
- [ ] Logs directory created: `logs/`
- [ ] Daily rotation enabled for log files
- [ ] No sensitive data in logs (tokens, passwords, PII)

### Monitoring

- [ ] Health endpoint `/health` accessible and responds quickly
- [ ] Logs being written to `logs/` directory
- [ ] No ERROR level logs on startup (only INFO, WARN)
- [ ] Database and cache connectivity confirmed

---

## Documentation

### Updated Files

- [x] `.env.example` - environment variables documented
- [x] `DEPLOYMENT_GUIDE.md` - step-by-step deployment instructions
- [x] `README.md` - MCP server section added
- [x] `PROJECT_STRUCTURE.md` - lib/mcp entry documented
- [x] `lib/mcp/README.md` - MCP server usage notes
- [x] `SECURITY.md` - comprehensive security guidelines
- [x] `.github/workflows/ci.yml` - CI pipeline includes MCP tests

### Deployment Runbook

- [ ] `DEPLOYMENT_GUIDE.md` reviewed and understood
- [ ] All commands tested locally before production run
- [ ] Deployment steps documented in team wiki/docs
- [ ] Rollback procedure documented (docker-compose down -v)

---

## Final Sign-Off

- [ ] All local tests passing (`npm run test:all`)
- [ ] TypeScript build succeeds (`npm run build`)
- [ ] Docker build succeeds (`docker compose -f docker-compose.prod.yml build`)
- [ ] All services start and stay healthy
- [ ] No errors in logs after 5 minutes of running
- [ ] Deployment checklist reviewed by team lead
- [ ] Ready for production deployment ✅

---

## Rollback & Recovery

If deployment fails:

1. Stop services: `docker compose -f docker-compose.prod.yml down`
1. Review logs: `docker compose -f docker-compose.prod.yml logs --tail=100`
1. Fix environment or code
1. Rebuild: `docker compose -f docker-compose.prod.yml up -d --build`
1. If database corruption: `docker compose -f docker-compose.prod.yml down -v` (⚠️ data loss)

---

**Last Updated:** 2025-12-14

**Status:** Ready for deployment
