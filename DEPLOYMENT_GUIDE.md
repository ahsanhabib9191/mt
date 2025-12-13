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

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Edit `.env` with your settings:

```env
# Database
MONGODB_URI=mongodb://meta_mongo:27017/meta-data
REDIS_URL=redis://meta_redis:6379

# Security (Generate a random 32-byte key)
ENCRYPTION_KEY=your-32-byte-encryption-key-here
NEXTAUTH_SECRET=your-jwt-secret-here

# Meta API (Optional - Leave blank for Mock Mode)
META_APP_ID=
META_APP_SECRET=

# Optimization
OPTIMIZATION_MODE=MONITOR  # or ACTIVE for auto-execution

# Server
PORT=3000
NODE_ENV=production
CORS_ORIGIN=*
```

**To generate secure keys:**
```bash
# Encryption key (32 bytes)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# JWT secret
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

You should see:
- `meta_client` (Frontend) - Port 8080
- `meta_api` (Backend) - Port 3000
- `meta_worker` (Background Jobs)
- `meta_optimizer` (AI Brain)
- `meta_mongo` (Database)
- `meta_redis` (Cache)

### Step 5: Access the Application

Open your browser:
- **Dashboard**: http://localhost:8080
- **API Health Check**: http://localhost:3000/health

---

## 🎯 What to Do Next

### Option A: Test with Mock Mode (Recommended First)

Mock Mode lets you test the entire system without spending real money.

1. **Access Dashboard**: http://localhost:8080
2. **Click "Boost"** to create a campaign
3. **Fill in campaign details** (use any URL, the scraper will simulate data)
4. **Launch Campaign** - It will be queued and processed
5. **Check Dashboard** - View the "Activity Feed" for AI recommendations

**Mock Mode Features:**
- ✅ Simulated campaign launches
- ✅ Fake performance data (clicks, spend, conversions)
- ✅ AI optimization recommendations
- ✅ No real money spent

### Option B: Connect Real Meta Account

To manage real Facebook/Instagram ads:

1. **Get Meta Credentials**:
   - Go to [developers.facebook.com](https://developers.facebook.com)
   - Create an App (Marketing API)
   - Copy `App ID` and `App Secret`

2. **Update `.env`**:
   ```env
   META_APP_ID=your_real_app_id
   META_APP_SECRET=your_real_app_secret
   ```

3. **Restart Services**:
   ```bash
   docker compose -f docker-compose.prod.yml restart api_server
   ```

4. **Connect Account**:
   - Go to Dashboard
   - Click "Connect with Facebook"
   - Authorize your ad account

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
# Restart all
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

## 🧪 Testing the Optimization Engine

The AI "Brain" runs automatically every 5 minutes. To trigger it manually:

```bash
# Enter the optimizer container
docker exec -it meta_optimizer sh

# Run optimization manually
node dist/scripts/run-optimization.js

# Exit container
exit
```

**What the Brain Does:**
- Analyzes campaign performance (ROAS, CPA, CTR)
- Identifies winners and losers
- Recommends actions (Scale, Pause, Adjust)
- Logs all decisions to the Activity Feed

---

## 📊 Monitoring

### Check Database

```bash
# Enter MongoDB container
docker exec -it meta_mongo mongosh

# View databases
show dbs

# Use meta-data database
use meta-data

# View collections
show collections

# View campaigns
db.campaigns.find().pretty()

# Exit
exit
```

### Check Redis Cache

```bash
# Enter Redis container
docker exec -it meta_redis redis-cli

# View all keys
KEYS *

# Exit
exit
```

---

## 🔧 Troubleshooting

### Port Already in Use

If ports 3000 or 8080 are taken:

```bash
# Find what's using the port
lsof -i :3000
lsof -i :8080

# Kill the process
kill -9 <PID>

# Or change ports in docker-compose.prod.yml
```

### Container Won't Start

```bash
# View detailed logs
docker compose -f docker-compose.prod.yml logs <service_name>

# Rebuild from scratch
docker compose -f docker-compose.prod.yml down -v
docker compose -f docker-compose.prod.yml up -d --build
```

### Database Connection Issues

```bash
# Check if MongoDB is healthy
docker compose -f docker-compose.prod.yml ps

# Restart MongoDB
docker compose -f docker-compose.prod.yml restart mongo

# Check MongoDB logs
docker compose -f docker-compose.prod.yml logs mongo
```

### Frontend Not Loading

```bash
# Check Nginx logs
docker compose -f docker-compose.prod.yml logs client

# Verify API is reachable
curl http://localhost:3000/health

# Rebuild client
docker compose -f docker-compose.prod.yml up -d --build client
```

---

## 🚀 Production Deployment (AWS/GCP/Azure)

### Option 1: Docker Compose on VM

1. **Provision a VM** (Ubuntu 22.04, 4GB RAM minimum)
2. **Install Docker** on the VM
3. **Clone repo** and configure `.env`
4. **Run** `docker compose -f docker-compose.prod.yml up -d`
5. **Configure firewall** to allow ports 80/443
6. **Set up Nginx reverse proxy** (optional, for SSL)

### Option 2: Kubernetes

Use the Docker images as base for K8s deployments:
- `meta_api` → API Deployment
- `meta_client` → Frontend Deployment
- `meta_worker` → Worker Deployment
- `meta_optimizer` → CronJob (every 5 minutes)

### Option 3: AWS ECS/Fargate

1. **Push images to ECR**:
   ```bash
   docker tag meta_api:latest <aws-account>.dkr.ecr.us-east-1.amazonaws.com/meta-api
   docker push <aws-account>.dkr.ecr.us-east-1.amazonaws.com/meta-api
   ```

2. **Create ECS Task Definitions** for each service
3. **Deploy to Fargate** with Application Load Balancer

---

## 📚 Additional Resources

- **README.md** - Project overview
- **FEATURES.md** - Detailed feature list
- **WHATS_NEXT.md** - Future roadmap and limitations
- **PROJECT_STRUCTURE.md** - Codebase map
- **META_ADS_OPTIMIZATION_STRATEGY.md** - How the AI thinks

---

## 🆘 Getting Help

If you encounter issues:

1. **Check logs** first (see "View Logs" section above)
2. **Review** `WHATS_NEXT.md` for known limitations
3. **Search** GitHub Issues
4. **Open an issue** with logs and error messages

---

## ✅ Quick Start Checklist

- [ ] Docker Desktop installed and running
- [ ] Repository cloned
- [ ] `.env` file configured
- [ ] `docker compose -f docker-compose.prod.yml up -d --build` executed
- [ ] All 6 containers running (`docker compose ps`)
- [ ] Dashboard accessible at http://localhost:8080
- [ ] API health check passing at http://localhost:3000/health
- [ ] Test campaign created in Mock Mode
- [ ] Activity Feed showing optimization logs

**Estimated setup time:** 15-20 minutes

---

*Built with ❤️ by the Giant Tech Team*
