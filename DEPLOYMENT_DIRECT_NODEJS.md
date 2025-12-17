# 🚀 Direct Node.js Deployment Guide (No Docker)

If Docker Desktop is not available or unstable, you can deploy the Meta Ads Optimization platform directly using Node.js 20+.

## Prerequisites

- Node.js 20+ installed
- MongoDB running (local or remote)
- Redis running (local or remote)
- Terminal/Shell access

## Setup Steps

### Step 1: Install Dependencies

```zsh
npm install
```

### Step 2: Create Production `.env` File

```zsh
cp .env.example .env
```

Edit `.env` with production values:

```env
# Database
MONGODB_URI=mongodb://localhost:27017/meta-data
REDIS_URL=redis://localhost:6379

# Security (generate these)
ENCRYPTION_KEY=your-64-hex-chars-here
NEXTAUTH_SECRET=your-jwt-secret-here

# Optional: Meta API
META_APP_ID=
META_APP_SECRET=

# Server
PORT=3000
NODE_ENV=production
LOG_LEVEL=info
CORS_ORIGIN=https://yourdomain.com
OPTIMIZATION_MODE=MONITOR
```

### Step 3: Start MongoDB (if local)

#### Mongo Option A: Using Homebrew (macOS)

```zsh
brew services start mongodb-community
```

#### Mongo Option B: Using Docker (single service)

```zsh
docker run -d --name mongodb -p 27017:27017 mongo:6.0
```

#### Mongo Option C: Remote MongoDB Atlas

Use your MongoDB Atlas connection string in `.env`:

```env
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/meta-data
```

### Step 4: Start Redis (if local)

#### Redis Option A: Using Homebrew (macOS)

```zsh
brew services start redis
```

#### Redis Option B: Using Docker (single service)

```zsh
docker run -d --name redis -p 6379:6379 redis:7-alpine
```

#### Redis Option C: Remote Redis (AWS ElastiCache, etc.)

Use your Redis URL in `.env`:

```env
REDIS_URL=redis://user:password@host:6379
```

### Step 5: Build TypeScript

```zsh
npm run build
```

### Step 6: Run Database Migrations/Init (if needed)

```zsh
npm run test:db
```

### Step 7: Start the API Server

#### Development Mode (with hot reload)

```zsh
npm run dev
```

#### Production Mode

```zsh
npm start
```

Server will listen on `http://localhost:3000`.

### Step 8: Start Background Workers (optional)

In a separate terminal:

```zsh
node dist/scripts/launch-worker-process.js
```

### Step 9: Start Optimization Brain (optional, runs every 5 minutes)

In a separate terminal:

```zsh
while true; do
  node dist/scripts/run-optimization.js
  sleep 300
done
```

### Step 10: Start MCP Server (optional, for development/CI)

In a separate terminal:

```zsh
npm run mcp:start
```

MCP server listens on `http://localhost:5005`.

## Verification

### Check API Health

```zsh
curl -s http://localhost:3000/health | jq
```

Expected response:

```json
{
  "status": "ok",
  "timestamp": "2025-12-14T...",
  "database": "connected"
}
```

### Check Database Connection

```zsh
# From MongoDB shell
mongosh --eval "db.runCommand({ ping: 1 })"

# Or if remote:
mongosh "mongodb+srv://user:password@cluster.mongodb.net/meta-data" --eval "db.runCommand({ ping: 1 })"
```

### Check Redis Connection

```zsh
redis-cli ping
```

Expected response: `PONG`.

### Run Tests

```zsh
npm run test:all
```

## Process Management (Production)

### Using PM2 (Recommended)

```zsh
npm install -g pm2

# Start all services
pm2 start ecosystem.config.js

# Monitor
pm2 monit

# Logs
pm2 logs

# Stop
pm2 stop all

# Restart
pm2 restart all
```

### Using launchd (macOS)

Create `/Library/LaunchDaemons/com.meta-ads.api.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.meta-ads.api</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/node</string>
        <string>/path/to/mt/dist/server/index.js</string>
    </array>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/var/log/meta-ads-api.log</string>
    <key>StandardErrorPath</key>
    <string>/var/log/meta-ads-api-error.log</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>NODE_ENV</key>
        <string>production</string>
        <key>PORT</key>
        <string>3000</string>
    </dict>
</dict>
</plist>
```

Then load it:

```zsh
sudo launchctl load /Library/LaunchDaemons/com.meta-ads.api.plist
```

## Troubleshooting

### MongoDB Connection Error

```text
MongoServerSelectionError: connect ECONNREFUSED 127.0.0.1:27017
```

**Fix:**

- Verify MongoDB is running: `brew services list`
- Start MongoDB: `brew services start mongodb-community`
- Or use remote MongoDB Atlas and update `.env`

### Redis Connection Error

```text
Error: connect ECONNREFUSED 127.0.0.1:6379
```

**Fix:**

- Verify Redis is running: `redis-cli ping`
- Start Redis: `brew services start redis`
- Or use remote Redis and update `.env`

### Port Already in Use

```text
Error: listen EADDRINUSE :::3000
```

**Fix:**

```zsh
# Find process using port 3000
lsof -i :3000

# Kill it
kill -9 <PID>

# Or change port in .env
PORT=3001
```

### Missing Environment Variables

```text
Missing or invalid required environment variables. Aborting startup.
```

**Fix:** Ensure all required variables in `.env`:

```env
MONGODB_URI=...
REDIS_URL=...
ENCRYPTION_KEY=... (64 hex chars)
NEXTAUTH_SECRET=...
```

## Logs

Logs are written to `logs/` directory with daily rotation (Winston logger).

View live logs:

```zsh
tail -f logs/combined.log
```

## Monitoring

### Memory & CPU

```zsh
top -l1 | head -20
# or
ps aux | grep node
```

### Network

```zsh
netstat -an | grep 3000
```

### Health Checks

```zsh
# API
curl http://localhost:3000/health

# Database
curl http://localhost:3000/api/db/health

# Cache
curl http://localhost:3000/api/cache/health
```

## Scaling

### Horizontal Scaling (Multiple Instances)

Use PM2 cluster mode:

```zsh
pm2 start dist/server/index.js -i max --name "api"
```

This starts one process per CPU core.

### Load Balancing

Use Nginx as reverse proxy:

```nginx
upstream api_backend {
    server localhost:3000;
    server localhost:3001;
    server localhost:3002;
}

server {
    listen 80;
    location / {
        proxy_pass http://api_backend;
        proxy_set_header Host $host;
    }
}
```
