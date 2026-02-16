/**
 * Local AI Risk Simulator
 * =======================
 * Mirrors the Python ML model's classification logic so the backend
 * can operate fully end-to-end without the external AI service.
 *
 * Feature extraction:
 *   HR_Mean       — mean of heart_rate_raw
 *   HR_Gradient   — max consecutive diff in heart_rate_raw
 *   Acc_Mean      — mean of accelerometer_raw
 *   Acc_Variance  — variance of accelerometer_raw
 *
 * Classification boundaries (derived from the training distributions):
 *   Class 0 (normal)  — HR_Mean < 110 AND Acc_Variance < 0.15
 *   Class 1 (playing)  — HR_Mean 110-135 OR Acc_Variance 0.15-0.8
 *   Class 2 (danger)   — HR_Mean ≥ 135 AND (Acc_Variance ≥ 0.8 OR HR_Gradient ≥ 15)
 *
 * Returns the exact same shape the real AI model would return.
 */

// ── Feature Extraction ───────────────────────────────────────────────

function mean(arr) {
  if (!arr.length) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function variance(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length;
}

function maxGradient(arr) {
  let maxDiff = 0;
  for (let i = 1; i < arr.length; i++) {
    maxDiff = Math.max(maxDiff, Math.abs(arr[i] - arr[i - 1]));
  }
  return maxDiff;
}

function extractFeatures(heartRateRaw, accelerometerRaw) {
  return {
    hr_mean: +mean(heartRateRaw).toFixed(1),
    hr_gradient: +maxGradient(heartRateRaw).toFixed(2),
    acc_mean: +mean(accelerometerRaw).toFixed(3),
    acc_variance: +variance(accelerometerRaw).toFixed(3),
  };
}

// ── Classification ───────────────────────────────────────────────────

const LABELS = { 0: "normal", 1: "playing", 2: "danger" };

function classify(features) {
  const { hr_mean, hr_gradient, acc_mean, acc_variance } = features;

  // ── Danger (Class 2) ──
  // High HR + high gradient OR high HR + high acc variance
  // Also catches "freeze" response: very high HR + virtually no movement
  if (
    (hr_mean >= 135 && hr_gradient >= 15) ||
    (hr_mean >= 135 && acc_variance >= 0.8) ||
    (hr_mean >= 140 && acc_variance < 0.05) // freeze: high HR, no movement
  ) {
    // Confidence based on how far above thresholds
    const hrScore = Math.min((hr_mean - 135) / 30, 1);
    const gradScore = Math.min(hr_gradient / 40, 1);
    const confidence = Math.min(60 + (hrScore + gradScore) * 20, 99);
    return { prediction_code: 2, confidence_percentage: +confidence.toFixed(1) };
  }

  // ── Playing (Class 1) ──
  if (
    (hr_mean >= 110 && hr_mean < 145) ||
    (acc_variance >= 0.15 && acc_variance < 0.8) ||
    (acc_mean >= 1.8 && acc_mean < 3.0)
  ) {
    const hrScore = hr_mean >= 110 ? Math.min((hr_mean - 100) / 40, 1) : 0;
    const accScore = acc_variance >= 0.15 ? Math.min(acc_variance / 0.6, 1) : 0;
    const confidence = Math.min(60 + (hrScore + accScore) * 17, 99);
    return { prediction_code: 1, confidence_percentage: +confidence.toFixed(1) };
  }

  // ── Normal (Class 0) ──
  const hrScore = hr_mean < 100 ? 1 : Math.max(0, 1 - (hr_mean - 100) / 30);
  const accScore = acc_variance < 0.1 ? 1 : Math.max(0, 1 - (acc_variance - 0.1) / 0.3);
  const confidence = Math.min(70 + (hrScore + accScore) * 15, 99);
  return { prediction_code: 0, confidence_percentage: +confidence.toFixed(1) };
}

// ── Public API (matches real AI model response shape) ────────────────

function simulateAiRiskModel({ heart_rate_raw, accelerometer_raw }) {
  const features = extractFeatures(heart_rate_raw, accelerometer_raw);
  const { prediction_code, confidence_percentage } = classify(features);

  return {
    prediction_code,
    confidence_percentage,
    status_label: LABELS[prediction_code],
    calculated_features: features,
  };
}

export { simulateAiRiskModel, extractFeatures, classify, LABELS };
