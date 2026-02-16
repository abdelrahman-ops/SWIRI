/**
 * Simulation Controller
 * =====================
 * Acts as the "watch / wearable device" sending data to the backend.
 * One endpoint triggers the full pipeline:
 *
 *   POST /api/simulate/watch-data
 *   {
 *     childId, coordinates?, heart_rate_raw, accelerometer_raw,
 *     source?, scenario?
 *   }
 *
 * The pipeline:
 *   1. Validate child exists
 *   2. Run AI risk model (simulator or external)
 *   3. Save RiskAssessment document
 *   4. Save Location if coordinates provided
 *   5. Check geofences for breach → create geofence alert
 *   6. If danger detected → create Alert + SOS event
 *   7. Emit socket events for all of the above
 *
 *   POST /api/simulate/scenario/:type
 *   type = "normal" | "playing" | "danger_struggle" | "danger_freeze" | "geofence_breach" | "sos"
 *   Generates realistic raw data for the chosen scenario automatically.
 */

import Child from "../models/Child.js";
import Location from "../models/Location.js";
import Alert from "../models/Alert.js";
import SosEvent from "../models/SosEvent.js";
import Geofence from "../models/Geofence.js";
import RiskAssessment from "../models/RiskAssessment.js";
import Device from "../models/Device.js";
import { invokeAiRiskModel } from "../services/aiRiskService.js";
import { distanceMeters } from "../utils/geo.js";
import { isWithinSchedule } from "../utils/schedule.js";
import { getIo } from "../socketStore.js";
import ApiError from "../core/ApiError.js";
import ApiResponse from "../core/ApiResponse.js";

// ── Helpers ──────────────────────────────────────────────────────────

function randomNormal(mean, std) {
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z * std;
}

function generateHrRaw(hrMean, length = 30) {
  return Array.from({ length }, () =>
    Math.round(Math.max(40, Math.min(250, randomNormal(hrMean, 5))))
  );
}

function generateAccRaw(accMean, accVariance, length = 60) {
  const std = Math.sqrt(Math.max(accVariance, 0.001));
  return Array.from({ length }, () =>
    +Math.max(0, randomNormal(accMean, std)).toFixed(3)
  );
}

// ── Scenario presets ─────────────────────────────────────────────────

const SCENARIO_PRESETS = {
  normal: {
    hrMean: 85, hrStd: 5,
    accMean: 1.1, accVariance: 0.05,
    description: "Child at rest / walking normally",
  },
  playing: {
    hrMean: 128, hrStd: 8,
    accMean: 2.2, accVariance: 0.4,
    description: "Child running / playing actively",
  },
  danger_struggle: {
    hrMean: 155, hrStd: 12,
    accMean: 2.8, accVariance: 1.2,
    description: "Danger: struggle / assault pattern",
  },
  danger_freeze: {
    hrMean: 148, hrStd: 6,
    accMean: 1.0, accVariance: 0.01,
    description: "Danger: freeze response (high HR, no movement)",
  },
  geofence_breach: {
    hrMean: 90, hrStd: 5,
    accMean: 1.5, accVariance: 0.1,
    description: "Normal vitals but location outside safe zone",
    // coordinates will be set far from any geofence center
  },
  sos: {
    hrMean: 160, hrStd: 15,
    accMean: 3.0, accVariance: 1.5,
    description: "SOS emergency with extreme vitals",
  },
};

// ── Core pipeline ────────────────────────────────────────────────────

async function runPipeline({ childId, coordinates, heart_rate_raw, accelerometer_raw, source = "watch", scenarioName }) {
  const child = await Child.findById(childId).populate("guardians");
  if (!child) throw new ApiError(404, "Child not found", "NOT_FOUND");

  const io = getIo();
  const timeline = [];  // collect all events for the response

  // 1. Run AI Risk Model
  const aiResult = await invokeAiRiskModel({ heart_rate_raw, accelerometer_raw });
  timeline.push({ step: "ai_classification", result: aiResult });

  // 2. Save RiskAssessment
  let triggeredAlert = null;

  const riskDoc = await RiskAssessment.create({
    child: childId,
    source,
    rawPayload: { heart_rate_raw, accelerometer_raw },
    aiResponse: aiResult,
    aiModelUrl: process.env.AI_RISK_MODEL_URL || "local-simulator",
  });
  timeline.push({ step: "risk_assessment_saved", id: riskDoc._id });

  // Emit risk assessment event
  if (io) {
    io.to(`child:${childId}`).emit("risk:assessed", {
      childId,
      assessment: riskDoc,
    });
  }

  // 3. Save Location if coordinates provided
  let locationDoc = null;
  if (coordinates && coordinates.length === 2) {
    locationDoc = await Location.create({
      child: childId,
      device: child.device || undefined,
      coordinates: { type: "Point", coordinates },
      accuracy: 10,
      recordedAt: new Date(),
    });
    timeline.push({ step: "location_saved", id: locationDoc._id });

    if (child.device) {
      await Device.findByIdAndUpdate(child.device, { lastSeenAt: new Date() });
    }

    // Emit location update
    if (io) {
      io.to(`child:${childId}`).emit("location:update", { childId, location: locationDoc });
    }

    // 4. Check geofences
    const geofences = await Geofence.find({ child: childId, active: true });
    for (const fence of geofences) {
      if (!isWithinSchedule(fence.schedule)) continue;

      const dist = distanceMeters(fence.center.coordinates, coordinates);
      if (dist > fence.radiusM) {
        const geoAlert = await Alert.create({
          type: "geofence",
          severity: "high",
          child: childId,
          message: `${child.name} left safe zone "${fence.name}" (${Math.round(dist)}m away)`,
          location: { type: "Point", coordinates },
          recipients: child.guardians?.map((g) => g._id || g) || [],
        });
        timeline.push({ step: "geofence_breach", fence: fence.name, distance: Math.round(dist), alertId: geoAlert._id });

        if (io) {
          io.to(`child:${childId}`).emit("alert:new", { alert: geoAlert });
          (child.guardians || []).forEach((g) => {
            const gId = g._id?.toString() || g.toString();
            io.to(`user:${gId}`).emit("alert:new", { alert: geoAlert });
          });
        }
      }
    }
  }

  // 5. If DANGER detected → create vitals alert + SOS
  if (aiResult.prediction_code === 2) {
    // Create vitals alert
    const dangerAlert = await Alert.create({
      type: "vitals",
      severity: "critical",
      child: childId,
      message: `⚠️ DANGER detected for ${child.name}: ${aiResult.status_label} (${aiResult.confidence_percentage}% confidence). HR=${aiResult.calculated_features.hr_mean} bpm`,
      location: coordinates ? { type: "Point", coordinates } : undefined,
      recipients: child.guardians?.map((g) => g._id || g) || [],
    });
    triggeredAlert = dangerAlert._id;
    timeline.push({ step: "danger_alert_created", alertId: dangerAlert._id, severity: "critical" });

    if (io) {
      io.to(`child:${childId}`).emit("alert:new", { alert: dangerAlert });
      (child.guardians || []).forEach((g) => {
        const gId = g._id?.toString() || g.toString();
        io.to(`user:${gId}`).emit("alert:new", { alert: dangerAlert });
      });
    }

    // Auto-trigger SOS
    const sosEvent = await SosEvent.create({
      child: childId,
      triggeredBy: "auto",
      location: coordinates ? { type: "Point", coordinates } : undefined,
      status: "active",
    });
    timeline.push({ step: "sos_auto_triggered", sosId: sosEvent._id });

    const sosAlert = await Alert.create({
      type: "sos",
      severity: "critical",
      child: childId,
      message: `🚨 AUTO SOS for ${child.name} — AI detected danger pattern`,
      location: coordinates ? { type: "Point", coordinates } : undefined,
      recipients: child.guardians?.map((g) => g._id || g) || [],
    });
    timeline.push({ step: "sos_alert_created", alertId: sosAlert._id });

    if (io) {
      io.to(`child:${childId}`).emit("sos:new", { event: sosEvent, alert: sosAlert });
      (child.guardians || []).forEach((g) => {
        const gId = g._id?.toString() || g.toString();
        io.to(`user:${gId}`).emit("sos:new", { event: sosEvent, alert: sosAlert });
      });
    }

    // Link alert to risk assessment
    riskDoc.triggeredAlert = triggeredAlert;
    await riskDoc.save();
  }

  // 6. If PLAYING detected → optional movement alert
  if (aiResult.prediction_code === 1 && aiResult.confidence_percentage > 90) {
    const playAlert = await Alert.create({
      type: "movement",
      severity: "low",
      child: childId,
      message: `${child.name} is very active (playing/running). HR=${aiResult.calculated_features.hr_mean} bpm`,
      location: coordinates ? { type: "Point", coordinates } : undefined,
      recipients: child.guardians?.map((g) => g._id || g) || [],
    });
    timeline.push({ step: "activity_alert", alertId: playAlert._id, severity: "low" });

    if (io) {
      io.to(`child:${childId}`).emit("alert:new", { alert: playAlert });
    }
  }

  return {
    scenario: scenarioName || "custom",
    classification: {
      prediction_code: aiResult.prediction_code,
      status_label: aiResult.status_label,
      confidence_percentage: aiResult.confidence_percentage,
    },
    features: aiResult.calculated_features,
    riskAssessmentId: riskDoc._id,
    locationId: locationDoc?._id || null,
    triggeredAlert,
    timeline,
  };
}

// ── Controllers ──────────────────────────────────────────────────────

/**
 * POST /api/simulate/watch-data
 * Body: { childId, coordinates?, heart_rate_raw, accelerometer_raw, source? }
 */
const simulateWatchData = async (req, res, next) => {
  try {
    const { childId, coordinates, heart_rate_raw, accelerometer_raw, source } = req.body;
    const result = await runPipeline({ childId, coordinates, heart_rate_raw, accelerometer_raw, source });
    return ApiResponse.created(res, result, `Watch data processed: ${result.classification.status_label}`);
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/simulate/scenario/:type
 * Body: { childId, coordinates? }
 * type = normal | playing | danger_struggle | danger_freeze | geofence_breach | sos
 */
const simulateScenario = async (req, res, next) => {
  try {
    const { type } = req.params;
    const { childId, coordinates } = req.body;

    const preset = SCENARIO_PRESETS[type];
    if (!preset) {
      return next(new ApiError(400, `Unknown scenario: ${type}. Use: ${Object.keys(SCENARIO_PRESETS).join(", ")}`, "VALIDATION_ERROR"));
    }

    const heart_rate_raw = generateHrRaw(preset.hrMean);
    const accelerometer_raw = generateAccRaw(preset.accMean, preset.accVariance);

    // For geofence_breach, shift coordinates far from any geofence if not provided
    let coords = coordinates;
    if (type === "geofence_breach" && !coords) {
      // Default to a location far from Cairo (default geofence area)
      coords = [29.0, 28.0]; // ~250 km from Cairo
    }

    const result = await runPipeline({
      childId,
      coordinates: coords,
      heart_rate_raw,
      accelerometer_raw,
      source: "watch",
      scenarioName: type,
    });

    return ApiResponse.created(res, {
      ...result,
      scenarioDescription: preset.description,
      generatedData: {
        heart_rate_raw_sample: heart_rate_raw.slice(0, 5),
        accelerometer_raw_sample: accelerometer_raw.slice(0, 5),
      },
    }, `Scenario "${type}" executed: ${result.classification.status_label}`);
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/simulate/full-demo
 * Body: { childId, coordinates? }
 * Runs ALL scenarios sequentially for the given child — perfect for demos.
 */
const simulateFullDemo = async (req, res, next) => {
  try {
    const { childId, coordinates } = req.body;
    const demoResults = [];

    for (const [type, preset] of Object.entries(SCENARIO_PRESETS)) {
      const hr = generateHrRaw(preset.hrMean);
      const acc = generateAccRaw(preset.accMean, preset.accVariance);

      let coords = coordinates || [31.2357, 30.0444];
      if (type === "geofence_breach") {
        coords = [29.0, 28.0];
      }

      try {
        const result = await runPipeline({
          childId,
          coordinates: coords,
          heart_rate_raw: hr,
          accelerometer_raw: acc,
          source: "watch",
          scenarioName: type,
        });
        demoResults.push({
          scenario: type,
          description: preset.description,
          status: result.classification.status_label,
          confidence: result.classification.confidence_percentage,
          alerts_triggered: result.timeline.filter((t) => t.step.includes("alert") || t.step.includes("sos")).length,
        });
      } catch (scenarioErr) {
        demoResults.push({ scenario: type, error: scenarioErr.message });
      }
    }

    return ApiResponse.created(res, { childId, scenarios: demoResults }, "Full demo completed");
  } catch (err) {
    return next(err);
  }
};

export { simulateWatchData, simulateScenario, simulateFullDemo, SCENARIO_PRESETS };
