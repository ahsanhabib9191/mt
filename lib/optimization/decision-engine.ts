export interface PerformanceMetrics {
  impressions: number;
  clicks: number;
  conversions: number;
  spend: number;
  revenue?: number;
  ctr?: number; // percent (e.g., 1.2 for 1.2%)
  cvr?: number; // percent
  cpa?: number;
  roas?: number;
  frequency?: number;
  cpc?: number;
  ageDays: number;
  optimizationEvents: number;
  dailyBudget: number;
  targetCPA: number;
  targetROAS?: number;
}

export interface CreativeTrend {
  direction: 'UP' | 'DOWN' | 'FLAT';
  pctChange: number; // percent change over reference window
}

export interface CreativeFatigueSignals {
  frequency: number;
  ctrTrend: CreativeTrend;
  cpcTrend: CreativeTrend;
  ageDays: number;
}

export interface FatigueSignal {
  type: string;
  severity: 'info' | 'warning' | 'critical';
  value?: number;
  explanation: string;
}

export interface FatigueAssessment {
  fatigued: boolean;
  signals: FatigueSignal[];
  recommendation: 'REFRESH_CREATIVE' | 'MONITOR';
}

export interface LearningPhaseProgress {
  status: string;
  eventsCount: number;
  eventsNeeded: number;
  progressPercentage: number;
  estimatedCompletionDays: number;
  onTrack: boolean;
  dailyEventRate: number;
}

const MIN_IMPRESSIONS_FOR_DECISION = 1000;
const MIN_CLICKS_FOR_DECISION = 100;
const MIN_CONVERSIONS_FOR_DECISION = 10;
const MIN_EVENTS_TO_EXIT_LEARNING = 50;

function hasMatureSample(metrics: PerformanceMetrics): boolean {
  const hasImpressions = metrics.impressions >= MIN_IMPRESSIONS_FOR_DECISION;
  const hasClicksOrConversions = metrics.clicks >= MIN_CLICKS_FOR_DECISION || metrics.conversions >= MIN_CONVERSIONS_FOR_DECISION;
  return hasImpressions && hasClicksOrConversions;
}

export function shouldPauseAd(metrics: PerformanceMetrics): boolean {
  if (!hasMatureSample(metrics)) {
    return false;
  }

  if (metrics.targetCPA && metrics.cpa !== undefined && metrics.cpa > metrics.targetCPA * 2.5) {
    return true;
  }

  if (metrics.roas !== undefined && metrics.roas < 1.0) {
    return true;
  }

  if (metrics.ctr !== undefined && metrics.ctr < 0.3) {
    return true;
  }

  if (metrics.frequency !== undefined && metrics.frequency > 5.0) {
    return true;
  }

  if (metrics.cpc !== undefined && metrics.cpc > 5.0) {
    return true;
  }

  return false;
}

export function isWinner(metrics: PerformanceMetrics): boolean {
  if (!hasMatureSample(metrics)) {
    return false;
  }

  const hasMinimumConversions = metrics.conversions >= 30 && metrics.ageDays >= 7;
  const proROAS = metrics.roas !== undefined && metrics.roas > 3.0;
  const proCPA = metrics.cpa !== undefined && metrics.cpa < metrics.targetCPA * 0.8;

  return hasMinimumConversions && proROAS && proCPA;
}

export function calculateScaledBudget(
  currentBudget: number,
  totalCampaignBudget: number,
  metrics: PerformanceMetrics
): { newBudget: number; reason: string } {
  const baseScale = metrics.roas && metrics.roas > 5.0 ? 1.3 : 1.2;
  const scaled = currentBudget * baseScale;
  const maxBudget = totalCampaignBudget * 0.4;
  const capped = Math.min(scaled, maxBudget);

  const reason = metrics.roas && metrics.roas > 5.0 ? 'Exceptional ROAS; scale +30%' : 'Standard winner scale +20%';
  return { newBudget: Math.max(currentBudget, capped), reason };
}

export function detectCreativeFatigue(signals: CreativeFatigueSignals): FatigueAssessment {
  const fatigueSignals: FatigueSignal[] = [];

  if (signals.frequency > 3.0) {
    fatigueSignals.push({
      type: 'HIGH_FREQUENCY',
      severity: signals.frequency > 5.0 ? 'critical' : 'warning',
      value: signals.frequency,
      explanation: 'Users have seen the creative too many times',
    });
  }

  if (signals.ctrTrend.direction === 'DOWN' && signals.ctrTrend.pctChange <= -20) {
    fatigueSignals.push({
      type: 'DECLINING_CTR',
      severity: 'warning',
      value: signals.ctrTrend.pctChange,
      explanation: 'CTR dropped 20%+ over the past week',
    });
  }

  if (signals.cpcTrend.direction === 'UP' && signals.cpcTrend.pctChange >= 30) {
    fatigueSignals.push({
      type: 'RISING_CPC',
      severity: 'warning',
      value: signals.cpcTrend.pctChange,
      explanation: 'Cost per click increased 30%+ over the past week',
    });
  }

  if (signals.ageDays >= 14) {
    fatigueSignals.push({
      type: 'TIME_THRESHOLD',
      severity: signals.ageDays > 21 ? 'warning' : 'info',
      value: signals.ageDays,
      explanation: 'Creative has been running for 14+ days',
    });
  }

  const criticalCount = fatigueSignals.filter((signal) => signal.severity === 'critical').length;
  const warningCount = fatigueSignals.filter((signal) => signal.severity === 'warning').length;
  const fatigued = criticalCount > 0 || warningCount >= 2;

  return {
    fatigued,
    signals: fatigueSignals,
    recommendation: fatigued ? 'REFRESH_CREATIVE' : 'MONITOR',
  };
}

export function checkLearningPhaseProgress(
  metrics: Pick<PerformanceMetrics, 'optimizationEvents' | 'ageDays'> & { learningStatus?: string }
): LearningPhaseProgress {
  const targetEvents = MIN_EVENTS_TO_EXIT_LEARNING;
  const events = metrics.optimizationEvents;
  const days = Math.max(metrics.ageDays, 1);
  const dailyRate = events / days;
  const remaining = Math.max(targetEvents - events, 0);
  const estimatedDays = Math.ceil(remaining / Math.max(dailyRate, 1));

  return {
    status: metrics.learningStatus || 'UNKNOWN',
    eventsCount: events,
    eventsNeeded: remaining,
    progressPercentage: (events / targetEvents) * 100,
    estimatedCompletionDays: estimatedDays,
    onTrack: dailyRate >= 7,
    dailyEventRate: dailyRate,
  };
}
