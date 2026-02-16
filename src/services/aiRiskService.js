import ApiError from "../core/ApiError.js";
import { simulateAiRiskModel } from "./aiSimulator.js";

const invokeAiRiskModel = async ({ heart_rate_raw, accelerometer_raw }) => {
  const modelUrl = process.env.AI_RISK_MODEL_URL;

  // ── Fallback to local simulator when no external AI is configured ──
  if (!modelUrl || modelUrl === "simulate" || modelUrl.includes("your-ai-model")) {
    console.log("[AI] Using local simulator (no external AI configured)");
    return simulateAiRiskModel({ heart_rate_raw, accelerometer_raw });
  }

  const headers = {
    "Content-Type": "application/json"
  };

  if (process.env.AI_RISK_MODEL_API_KEY) {
    headers.Authorization = `Bearer ${process.env.AI_RISK_MODEL_API_KEY}`;
  }

  let response;
  try {
    response = await fetch(modelUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ heart_rate_raw, accelerometer_raw }),
      signal: AbortSignal.timeout(10000),
    });
  } catch (fetchErr) {
    // Network error / timeout → fall back to simulator
    console.warn("[AI] External model unreachable, falling back to simulator:", fetchErr.message);
    return simulateAiRiskModel({ heart_rate_raw, accelerometer_raw });
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    // External model returned an error → fall back to simulator
    console.warn("[AI] External model error, falling back to simulator:", response.status);
    return simulateAiRiskModel({ heart_rate_raw, accelerometer_raw });
  }

  const requiredFields = ["prediction_code", "confidence_percentage", "status_label", "calculated_features"];
  const missingFields = requiredFields.filter((field) => payload?.[field] === undefined);
  if (missingFields.length) {
    console.warn("[AI] External model response invalid, falling back to simulator");
    return simulateAiRiskModel({ heart_rate_raw, accelerometer_raw });
  }

  return payload;
};

export { invokeAiRiskModel };
