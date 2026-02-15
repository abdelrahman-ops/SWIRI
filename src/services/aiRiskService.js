import ApiError from "../core/ApiError.js";

const invokeAiRiskModel = async ({ heart_rate_raw, accelerometer_raw }) => {
  const modelUrl = process.env.AI_RISK_MODEL_URL;

  if (!modelUrl) {
    throw new ApiError(500, "AI_RISK_MODEL_URL is not configured", "CONFIG_ERROR");
  }

  const headers = {
    "Content-Type": "application/json"
  };

  if (process.env.AI_RISK_MODEL_API_KEY) {
    headers.Authorization = `Bearer ${process.env.AI_RISK_MODEL_API_KEY}`;
  }

  const response = await fetch(modelUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({ heart_rate_raw, accelerometer_raw })
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new ApiError(
      502,
      "AI model request failed",
      "AI_MODEL_ERROR",
      payload || { status: response.status, statusText: response.statusText }
    );
  }

  const requiredFields = ["prediction_code", "confidence_percentage", "status_label", "calculated_features"];
  const missingFields = requiredFields.filter((field) => payload?.[field] === undefined);
  if (missingFields.length) {
    throw new ApiError(502, "AI model response is invalid", "AI_MODEL_INVALID_RESPONSE", { missingFields });
  }

  return payload;
};

export { invokeAiRiskModel };
