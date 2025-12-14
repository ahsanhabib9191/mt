# Meta Ads Optimization Strategy & Rules

## Comprehensive Guide for Autonomous Campaign Management

- **Platform:** Shothik AI (Invisible Friend)
- **Version:** 1.0
- **Last Updated:** October 19, 2025
- **Purpose:** Define the logic, rules, and best practices for autonomous Meta/Facebook Ads optimization

---

## 1. Optimization Philosophy

### Core Principles

Our optimization system follows **data-driven decision-making with human oversight** based on these foundational principles:

#### 1.1 Patience Over Impulse

**Principle:** Let the data mature before making decisions.
**Why:** Meta's algorithm needs time to learn. Premature optimization disrupts the learning phase and wastes budget on restarts.
**Rule:** Minimum 3-7 days OR 50 optimization events before any optimization action.

#### 1.2 Gradual Scaling

**Principle:** Scale winning campaigns incrementally, not aggressively.
**Why:** Rapid budget increases (>20% daily) reset Meta's learning phase, causing performance drops.
**Rule:** Maximum 20% daily budget increase, even for strong performers.

#### 1.3 Statistical Rigor

**Principle:** Base decisions on statistically significant data, not anecdotes.
**Why:** Small sample sizes create false positives/negatives. 100 clicks with 2 conversions doesn't prove anything.
**Rule:** Minimum sample sizes vary by decision type (detailed in Section 9).

#### 1.4 Diversification

**Principle:** Never allocate 100% of budget to a single ad or audience.
**Why:** Audience fatigue, creative burnout, and platform changes can devastate single-point dependency.
**Rule:** Top performer gets max 40% of total budget. Always run 3-5 active variants.

#### 1.5 Continuous Testing

**Principle:** Always reserve 20% of budget for new tests.
**Why:** Today's winner becomes tomorrow's loser. Continuous testing discovers new winners before old ones fail.
**Rule:** 80% budget on proven winners, 20% on new variants.

#### 1.6 Respect the Learning Phase

**Principle:** Meta's learning phase is sacred—do not interrupt it.
**Why:** Changes during learning reset the algorithm, wasting the initial data collection period.
**Rule:** Zero edits to budget, targeting, or creative during "Learning" status.

---

## 2. The Three-Phase Optimization Cycle

### Phase 1: LEARNING (Days 1-3)

**Objective:** Gather initial performance data without intervention.

**What Happens:**

- Meta's algorithm explores audience segments
- Delivery ramps up gradually (not instant)
- High cost per result is normal (exploration tax)
- Impressions may be inconsistent

**Platform Actions:**

- ✅ Monitor performance metrics
- ✅ Track learning phase progress
- ✅ Flag critical errors (approval issues, payment failures)
- ❌ DO NOT adjust budgets
- ❌ DO NOT pause underperformers
- ❌ DO NOT change targeting or creative

**Why This Matters:**

Meta's algorithm uses machine learning to find the best placements, times, and audiences. Interrupting this process forces a restart, wasting 3-7 days of data and budget. Let it learn.

**Technical Implementation:**

```typescript
if (adSet.delivery_info.status === "LEARNING") {
  return {
    action: "MONITOR_ONLY",
    reason: "learning_phase_protection",
    next_check: Date.now() + 24 * 60 * 60 * 1000 // Check again in 24 hours
  };
}
```

---

### Phase 2: TESTING (Days 4-7)

**Objective:** Identify winners and losers based on performance thresholds.

**What Happens:**

- Learning phase completes (50 optimization events reached)
- Performance stabilizes
- Clear winners/losers emerge
- Statistically significant data available

**Platform Actions:**

- ✅ Calculate performance benchmarks (average CPA, CTR, ROAS)
- ✅ Identify top 20% (winners) and bottom 20% (losers)
- ✅ Flag underperformers exceeding pause thresholds
- ✅ Alert user to major issues
- ⚠️ Pause only critical failures (CPA > 3x target, CTR < 0.3%)
- ❌ DO NOT scale yet (need consistency proof)

**Why This Matters:**

One good day doesn't make a winner. We need 3-7 days of consistent performance to confirm a trend, not an anomaly. Testing phase validates what learning phase discovered.

**Decision Tree:**

```text
For each ad/ad set:
1. Has it exited learning phase? (status = "Active")
2. Does it have minimum 100 clicks OR 10 conversions?
3. Is performance consistent for 3+ days?

If YES to all:
  → Compare to benchmarks
  → Tag as "Winner" (top 20%) or "Loser" (bottom 20%)

If NO to any:
  → Continue monitoring
  → Re-evaluate in 24 hours
```

---

### Phase 3: SCALING (Day 8+)

**Objective:** Maximize ROI by scaling winners and reallocating from losers.

**What Happens:**

- Winners proven with 7+ days of data
- Losers confirmed with statistical significance
- Budget reallocation begins
- Continuous optimization loop starts

**Platform Actions:**

- ✅ Scale winner budgets by +20% daily
- ✅ Pause bottom 30% of ads (losers)
- ✅ Reallocate paused budgets to winners proportionally
- ✅ Generate new ad variants based on winner patterns
- ✅ Refresh creative for ads with frequency > 3.0
- ✅ Expand audiences for ads with ROAS > 4.0

**Why This Matters:**

Now we have proof. Winners are statistical facts, not guesses. Scaling them maximizes profit. Cutting losers stops waste. This is where "Invisible Friend" earns its name—fully autonomous profit optimization.

**Scaling Formula:**

```text
Winner Criteria:
- ROAS > 3.0 (profitable)
- CPA < target_CPA * 0.8 (20% better than goal)
- Consistent for 7+ days
- No performance drop in last 48 hours

Scale Amount:
- Standard: +20% daily budget increase
- Exceptional (ROAS > 5.0): +30% daily increase
- Maximum single ad budget: 40% of total campaign budget
```

---

## 3. Performance Metrics & KPIs

### 3.1 Primary Metrics (Always Optimize For)

#### Cost Per Acquisition (CPA) / Cost Per Result (CPR)

**Definition:** Total ad spend ÷ Number of conversions
**Why It Matters:** Direct measure of efficiency. If CPA > product margin, you're losing money.
**Target:** Set by user based on product economics (e.g., $15 CPA for a $50 product with 50% margin)

**Calculation:**

```text
CPA = Total Spend / Conversions
Example: $500 spend / 25 sales = $20 CPA
```

---

#### Return on Ad Spend (ROAS)

**Definition:** Revenue generated ÷ Ad spend
**Why It Matters:** The ultimate profitability metric. ROAS < 1.0 means you're losing money.
**Target:** Minimum 2.0 for e-commerce (every $1 spent returns $2)

**Calculation:**

```text
ROAS = Revenue / Ad Spend
Example: $1,500 revenue / $500 spend = 3.0 ROAS (3x return)
```

---

#### Click-Through Rate (CTR)

**Definition:** (Clicks ÷ Impressions) × 100
**Why It Matters:** Measures ad relevance. Low CTR = wasted impressions on disinterested users.
**Target:** 0.9% - 1.2% (industry average for e-commerce)

**Calculation:**

```text
CTR = (Clicks / Impressions) × 100
Example: 150 clicks / 10,000 impressions = 1.5% CTR
```

---

#### Conversion Rate (CVR)

**Definition:** (Conversions ÷ Clicks) × 100
**Why It Matters:** Measures landing page quality. High CTR + low CVR = bad landing page.
**Target:** 2-3% for e-commerce

**Calculation:**

```text
CVR = (Conversions / Clicks) × 100
Example: 25 sales / 150 clicks = 16.67% CVR (excellent)
```

---

#### Cost Per Click (CPC)

**Definition:** Total spend ÷ Number of clicks
**Why It Matters:** Auction efficiency indicator. High CPC = losing auctions or low-quality score.
**Target:** < $1.00 for most e-commerce

**Calculation:**

```text
CPC = Total Spend / Clicks
Example: $500 spend / 150 clicks = $3.33 CPC
```

---

### 3.3 Calculated Metrics (Platform-Generated)

#### Break-Even CPA

```text
Break-Even CPA = Product Price - COGS (Cost of Goods Sold)
Example: $50 product - $20 COGS = $30 break-even CPA
```

---

#### Profit Per Sale

```text
Profit Per Sale = Revenue - (COGS + CPA)
Example: $50 - ($20 + $15) = $15 profit per sale
```

---

#### Daily Burn Rate

```text
Daily Burn Rate = Total Active Campaign Budgets
Example: 5 campaigns × $20/day = $100/day burn rate
```

---

### 4. Decision Rules & Thresholds

#### Time-Based Modifiers

```typescript
// First 48 hours: Be extra lenient
if (ad.age_hours < 48) {
  pause_threshold_cpa = target_cpa * 4.0; // 4x instead of 2.5x
  warning_threshold_cpa = target_cpa * 2.0; // 2x instead of 1.5x
}

// Days 3-7: Standard thresholds
else if (ad.age_days <= 7) {
  // Use normal thresholds
}
```
