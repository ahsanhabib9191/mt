export interface ConfidenceIntervalResult {
  cvr: number; // percent
  lower: number; // percent
  upper: number; // percent
  marginOfError: number; // percent
}

export function calculateConfidenceInterval(
  conversions: number,
  clicks: number,
  confidence: 0.95 | 0.9 = 0.95
): ConfidenceIntervalResult {
  if (clicks === 0) {
    return { cvr: 0, lower: 0, upper: 0, marginOfError: 0 };
  }

  const z = confidence === 0.95 ? 1.96 : 1.645;
  const cvr = conversions / clicks;
  const denominator = 1 + (z * z) / clicks;
  const center = cvr + (z * z) / (2 * clicks);
  const margin = z * Math.sqrt((cvr * (1 - cvr)) / clicks + (z * z) / (4 * clicks * clicks));
  const lowerBound = (center - margin) / denominator;
  const upperBound = (center + margin) / denominator;

  return {
    cvr: cvr * 100,
    lower: lowerBound * 100,
    upper: upperBound * 100,
    marginOfError: ((upperBound - lowerBound) / 2) * 100,
  };
}
