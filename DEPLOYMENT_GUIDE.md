# 🚀 Deployment Guide - Meta Ads Intelligence Platform

This guide provides step-by-step instructions for deploying and running the platform.

---

## 📋 Prerequisites

Before you begin, ensure you have:

- **Docker Desktop** installed and running ([Download](https://www.docker.com/products/docker-desktop))
- **Git** installed
- **Meta Developer Account** (optional, for real ads)
- **Minimum 4GB RAM** available for Docker

---

## 🐳 Running the Dockerized Version (Production)

### Step 1: Clone the Repository

```bash
git clone https://github.com/ahsanhabib9191/mt.git
cd mt
```

### Step 2: Configure Environment Variables

The authoritative list of environment variables is in `.env.example`. For production, copy that file and set secure values. The snippet below is a production-oriented subset derived from `.env.example`  it is not a replacement for the canonical file.

```bash
cp .env.example .env
```

Edit `.env` with your production settings. The example below shows only the common production subset and highlights required keys.

```env
# -- Required (production) -----------------
MONGODB_URI=mongodb://meta_mongo:27017/meta-data    # mandatory: production Mongo connection
REDIS_URL=redis://meta_redis:6379                   # mandatory: production Redis
ENCRYPTION_KEY=your-64-hex-chars-32byte-key         # mandatory: 32 bytes (64 hex chars)
NEXTAUTH_SECRET=your-jwt-secret-here                # mandatory: JWT signing secret

# Meta / OAuth (required only when connecting real Meta accounts)
META_APP_ID=                                        # optional for Mock Mode; required for real Meta
META_APP_SECRET=                                    # optional for Mock Mode; required for real Meta
META_VERIFY_TOKEN=your_webhook_verify_token         # required if registering webhooks
META_WEBHOOK_SECRET=your_meta_webhook_secret        # required for webhook signature verification

# -- Recommended / optional ----------------
PORT=3000
NODE_ENV=production
LOG_LEVEL=info

# OPTIMIZATION_MODE controls automated behavior. Use MONITOR for observation-only, ACTIVE to enable automated changes
OPTIMIZATION_MODE=MONITOR  # values: MONITOR | ACTIVE

# CORS origin: prefer a concrete dashboard origin in production (example below)
CORS_ORIGIN=https://dashboard.yourdomain.com

# Rate Limiting (optional)
RATE_LIMIT_ENABLED=true
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

Notes:

- `ENCRYPTION_KEY` must be a 32-byte key expressed as 64 hexadecimal characters. See `SECURITY.md` for details on key management.
- `OPTIMIZATION_MODE` should be set in `.env`. The `docker-compose.prod.yml` intentionally avoids hardcoding this value to prevent accidental overrides.

To generate secure keys:

```bash
# Encryption key (32 bytes -> 64 hex chars)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# JWT secret (recommended 64+ bytes)
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### Step 3: Build and Start the Docker Fleet

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

This command will:

- ✅ Build the Frontend (React + Nginx)
- ✅ Build the Backend (Node.js + Express)
- ✅ Start MongoDB database
- ✅ Start Redis cache
- ✅ Start Background Workers
- ✅ Start Optimization Brain

**Build time:** 5-10 minutes (first time only)

### Step 4: Verify Deployment

Check if all containers are running:

```bash
docker compose -f docker-compose.prod.yml ps
```

You should see service names like:

- `api_server` (service) → container `meta_api` - Port 3000
- `client` (service) → container `meta_client` - Port 8080
- `worker` (service) → container `meta_worker`
- `optimizer` (service) → container `meta_optimizer`
- `mongo` (service) → container `meta_mongo`
- `redis` (service) → container `meta_redis`

Important note on identifiers:

- This guide uses Compose service names (for example `api_server`) when running `docker compose` commands for portability.
- The `container_name` values (for example `meta_api`) are explicit container names set in the compose file; they may differ and are shown in the `docker compose ps` output under the "Containers" column.
- Use the service name with `docker compose` commands (recommended):

```bash
# Show services and their status (service names)
docker compose -f docker-compose.prod.yml ps

# View logs for the API service (use service name)
docker compose -f docker-compose.prod.yml logs -f api_server

# Restart the API service (use service name)
docker compose -f docker-compose.prod.yml restart api_server
```

If you prefer container-level commands (not recommended for compose-managed clusters), use the container names shown under "Containers".

### Step 5: Access the Application

Open your browser:

- **Dashboard**: [http://localhost:8080](http://localhost:8080)
- **API Health Check**: [http://localhost:3000/health](http://localhost:3000/health)

---

## 🎯 Mock Mode vs Real Meta Account (Safety and Toggles)

Mock Mode is the safe default for testing and demos. The application operates in mock mode when Meta credentials are not provided.

Toggle rules (explicit):

- If `META_APP_ID` or `META_APP_SECRET` in `.env` are empty/undefined, the system runs in Mock Mode (no real ad spend).
- If both `META_APP_ID` and `META_APP_SECRET` are set, the app will attempt to use the real Meta API and may perform actions that result in real ad spend.
- `OPTIMIZATION_MODE=ACTIVE` enables automated optimization actions (budget changes, pausing ads). Set `OPTIMIZATION_MODE=MONITOR` in staging or when you want observation-only behavior.

WARNING: Connecting real Meta credentials and enabling `OPTIMIZATION_MODE=ACTIVE` will allow the platform to make real changes to ad accounts and may incur costs. Only do this in production environments with appropriate approvals and budget controls in place.

If your deployment needs an explicit safety flag, set an additional environment variable (for example `FORCE_REAL_META=true`) and gate any production runbooks on its presence. The codebase checks for mock tokens (for example, access tokens beginning with `mock_`) and will bypass live API calls when a mock token is detected. See `lib/services/meta-sync/graph-client.ts` and `lib/services/meta-sync/sync-service.ts` for mock token handling and logic.

---

## 🛠️ Common Operations

### View Logs

```bash
# All services
docker compose -f docker-compose.prod.yml logs -f

# Specific service
docker compose -f docker-compose.prod.yml logs -f api_server
docker compose -f docker-compose.prod.yml logs -f optimizer
```

### Restart Services

```bash
# Restart all (service names)
docker compose -f docker-compose.prod.yml restart

# Restart specific service
docker compose -f docker-compose.prod.yml restart api_server
```

### Stop Everything

```bash
docker compose -f docker-compose.prod.yml down
```

### Stop and Remove Data (Clean Slate)

```bash
docker compose -f docker-compose.prod.yml down -v
```

### Update Code and Rebuild

```bash
git pull origin main
docker compose -f docker-compose.prod.yml up -d --build
```

---

## 🧪 Post-Deployment Validation

After the basic health checks, perform deeper validations to ensure the deployment is functioning end-to-end.

1. Check API health endpoint:

```bash
curl -s http://localhost:3000/health | jq
```

1. Confirm MongoDB is accepting connections (use `mongosh` in the container):

```bash
# Connect to mongo inside the compose cluster
docker compose -f docker-compose.prod.yml exec mongo mongosh --eval "db.runCommand({ ping: 1 })"
```

Note: The production `docker-compose.prod.yml` uses `mongosh` for the MongoDB healthcheck because the older `mongo` shell is no longer included in MongoDB 6.x images.

1. Check Redis is responding:

```bash
docker compose -f docker-compose.prod.yml exec redis redis-cli ping
```

1. Run built-in test scripts from within the API container for end-to-end verification (examples):

```bash
# Enter API container
docker compose -f docker-compose.prod.yml exec api_server sh

# From inside the container run tests or scripts
npm run test:db
npm run test:auth

# Exit
exit
```

1. Run client E2E tests against the running stack (requires Playwright configured):

```bash
# From host (or CI), run Playwright tests in client project
cd client
npm ci

# Then run your E2E command for this repo (example)
# npm run test:e2e
```
