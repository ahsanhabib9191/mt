# 🚀 Meta Ads Intelligence Platform (The "Invisible Friend")

> A "Giant Tech" grade autonomous advertising system that launches, monitors, and optimizes Meta Ads campaigns. Built with a React Frontend, Express Backend, and MongoDB/Redis architecture.

## 🌟 Key Features

*   **🧠 AI Optimization Brain**: An "Invisible Friend" that analyzes performance 24/7 and makes smart recommendations (Scale, Pause, Adjust).
*   **🛡️ Mock Mode Simulation**: Fully functional "Flight Simulator" for testing campaigns without spending real money.
*   **⚡ Resilient Launch Queue**: Background worker system ensuring 100% reliability for campaign launches, even during API outages.
*   **📊 Interactive Dashboard**: A beautiful React-based command center to visualize spend, ROAS, and system activity.
*   **🐳 Dockerized Infrastructure**: One-click deployment for the entire stack (Frontend, Backend, DB, Cache).

---

## 🏗️ Architecture

The system follows a scalable, microservices-ready pattern:

*   **Frontend**: React + Vite + TailwindCSS + Framer Motion (Port 80/8080)
*   **Backend**: Node.js + Express + TypeScript (Port 3000)
*   **Database**: MongoDB (Data Persistence)
*   **Cache/Queue**: Redis (Rate Limiting & Job Queue)
*   **Workers**: Dedicated processes for Analysis and Launching.

---

## ⚡ Quick Start (Production)

To run the entire fleet in production mode using Docker:

1.  **Stop local services** (free up ports 3000, 8080).
2.  **Configure Environment**:
    Ensure `.env` exists (see `.env.example`).
    For Real Ads, set `META_APP_ID` and `META_APP_SECRET`.
    For Mock Mode, leave them blank.
3.  **Launch Fleet**:

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

4.  **Access App**:
    *   **Dashboard**: [http://localhost:8080](http://localhost:8080)
    *   **API**: [http://localhost:3000](http://localhost:3000)

---

## 🛠️ Development Setup

If you want to contribute or modify code:

### 1. Backend
```bash
npm install
npm run docker:up  # Starts Mongo/Redis
npx ts-node server/index.ts
```

### 2. Frontend
```bash
cd client
npm install
npm run dev
```
Access at `http://localhost:5173`.

---

## 🧩 Local MCP Server (Development & CI)

*   Purpose: provide a predictable, local model-like endpoint for integration tests and local feature development.
*   Start locally: `npm run mcp:start` (use `npm run mcp:dev` for live reload during development).
*   Main endpoints: `GET /health`, `POST /mcp/request`.

See `lib/mcp/README.md` for details and examples.

---

## 🧪 Testing

*   **End-to-End**: `npm run test:e2e` (Simulates full user flow).
*   **Unit/Integration**: `npm run test:all`.
*   **Optimization Simulation**: `npx ts-node scripts/run-optimization.ts`.

---

## 📚 Documentation

*   [Features List](FEATURES.md) - Detailed breakdown of capabilities.
*   [Project Structure](PROJECT_STRUCTURE.md) - Map of the codebase.
*   [Optimization Strategy](META_ADS_OPTIMIZATION_STRATEGY.md) - How the AI thinks.
*   [OAuth Guide](docs/META_OAUTH_INTEGRATION.md) - Connecting Real Accounts.
*   [Meta API Integration Map](docs/META_API_INTEGRATION_MAP.md) - Quick map of requests, tokens, and storage.

---

*Built with ❤️ by the Giant Tech Team.*
