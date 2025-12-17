# 📂 Project Structure Map

This document outlines the organization of the "Giant Tech" repository.

## 📦 Root

- `docker-compose.prod.yml` - Production orchestration (App + DB + Nginx).
- `docker-compose.yml` - Dev infrastructure (DB Only).
- `package.json` - Root dependencies and scripts.
- `.env` - Environment configuration.

## 🖥️ Client (`/client`)

Built with React, Vite, and Tailwind.

- `src/App.tsx` - Main router and layout.
- `src/pages/` - Application Views:
  - `Dashboard.tsx` - Main Command Center.
  - `Boost.tsx` - Campaign Creation Wizard.
- `src/components/` - Reusable UI widgets (Charts, Cards, Forms).
- `src/hooks/` - Custom React Hooks for API data.
- `src/api/` - Axios client for backend communication.
- `nginx.conf` - Nginx configuration for serving the build.

## ⚙️ Server (`/server`)

Express.js API Server.

- `index.ts` - Entry point and App setup.
- `routes/` - API Endpoints:
  - `campaigns.ts` - CRUD for campaigns.
  - `optimization.ts` - Brain endpoints (Recommendations, Logs).
  - `launch.ts` - Campaign creation queue endpoints.
  - `auth.ts` - Meta OAuth flow.

## 📚 Libraries (`/lib`)

Shared business logic and services.

- `db/` - Database Layer:
  - `models/` - Mongoose Schemas (`Campaign`, `AdSet`, `PerformanceSnapshot`).
  - `redis.ts` - Cache client.
- `services/` - Core Services:
  - `meta-sync/` - Graph API Client (Real & Mock).
  - `optimization/` - The Intelligence Engine (`optimizer.ts`).
  - `queue/` - Job Queue logic.
  - `workers/` - Background processors.
- `utils/` - Helpers (Logger, Encryption).
- `mcp/` - Local MCP server used for development and CI experiments. Main files:
  - `lib/mcp/server.ts` - Minimal MCP-style HTTP server (endpoints: `GET /health`, `POST /mcp/request`).
  - `lib/mcp/README.md` - Local documentation and usage notes.

## 🛠️ Scripts (`/scripts`)

DevOps and Utility tools.

- `run-optimization.ts` - Manually triggers the AI Brain.
- `generate-mock-insights.ts` - Seeds fake data for testing.
- `reset-connections.ts` - Cleaning tool.
- `launch-worker-process.ts` - Entry point for the Background Worker.

## 📝 Docs (`/docs`)

Detailed documentation and reference guides.
