# 🚀 Future Development & Roadmap

**Current Status**: "Giant Tech" Foundation Complete (Phase 4).
**Next Phase**: Scaling & Intelligence (Phase 5+).

This document outlines the limitations of existing systems ("Lackings") and the roadmap to address them.

---

## 🛑 Current Lackings (Technical Debt)

### 1. Optimization Engine ("The Brain")
*   **Limitation**: Currently uses **Rule-Based Logic** (e.g., "If ROAS > 2, Scale").
*   **Risk**: Rules are rigid and don't adapt to complex market seasonality.
*   **Fix**: Move to **Predictive ML Models** (TensorFlow/Python) that forecast specific ROAS based on historical curves.

### 2. Job Queue
*   **Limitation**: Currently uses a simple Redis loop / in-memory processing or Docker loop.
*   **Risk**: If the server crashes mid-job, state might be inconsistent.
*   **Fix**: Implement **BullMQ** with strictly durable redis persistence and "Dead Letter Queues" for failed jobs.

### 3. Sync Architecture
*   **Limitation**: We pull data when needed (Lazy Loading) or via simple loop.
*   **Risk**: Rate limits can be hit if we scale to 100+ accounts.
*   **Fix**: Implement a **Graph API Webhook Consumer** that passively receives updates instead of polling.

### 4. Creative Studio
*   **Limitation**: Video generation (`remotion`) is headless (script-only).
*   **Risk**: Users can't preview changes visually before rendering.
*   **Fix**: Build a **Creative Editor UI** in React where users can drag-and-drop assets onto the video timeline.

---

## 🗺️ Future Roadmap

### Phase 5: Automation & SaaS (Next 2 Weeks)
*   [ ] **CI/CD Pipeline**: Automated GitHub Actions for Docker Build/Push.
*   [ ] **Stripe Integration**: Charge users per ad spend managed.
*   [ ] **Multi-Tenancy**: Strict data isolation for SaaS customers.

### Phase 6: Omnichannel Expansion (Q1 2026)
*   [ ] **TikTok Ads API**: Port the "Launch" and "Optimization" logic to TikTok.
*   [ ] **Google Ads API**: Add Search/YouTube support.

### Phase 7: Generative AI (Q2 2026)
*   [ ] **Visual GenAI**: Integrate Midjourney/Flux for auto-generating ad images.
*   [ ] **Copy GenAI**: Fine-tune a LLaMA model specifically on high-performing ad copy.

---

## 🔮 The "Trillion Dollar" Vision
Ultimately, this platform resolves to a single button: **"Make Money"**.
The user inputs a credit card and a URL, and the AI handles:
1.  Creative Generation.
2.  Audience Finding.
3.  Media Buying.
4.  Scaling.

*This is the path forward.*
