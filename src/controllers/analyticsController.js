import ActivitySummary from "../models/ActivitySummary.js";
import Child from "../models/Child.js";
import Alert from "../models/Alert.js";
import RiskAssessment from "../models/RiskAssessment.js";
import ApiError from "../core/ApiError.js";
import ApiResponse from "../core/ApiResponse.js";
import { getIo } from "../socketStore.js";
import { invokeAiRiskModel } from "../services/aiRiskService.js";

const behaviorInsights = async (req, res, next) => {
  try {
    const { childId } = req.params;
    const summaries = await ActivitySummary.find({ child: childId }).sort({ date: -1 }).limit(14);
    if (!summaries.length) {
      return res.json({ insights: { status: "insufficient-data" } });
    }

    const latest = summaries[0];
    const baseline = summaries.slice(1);

    const avg = (arr, key) => {
      const values = arr.map((s) => s[key]).filter((v) => typeof v === "number");
      if (!values.length) return null;
      return values.reduce((a, b) => a + b, 0) / values.length;
    };

    const baselineActive = avg(baseline, "activeMinutes") || latest.activeMinutes || 0;
    const baselineHrMax = avg(baseline, "heartRateMax") || latest.heartRateMax || 0;

    const flags = [];
    if (latest.activeMinutes !== undefined && baselineActive && latest.activeMinutes < baselineActive * 0.5) {
      flags.push("low-activity");
    }
    if (latest.heartRateMax !== undefined && baselineHrMax && latest.heartRateMax > baselineHrMax * 1.5) {
      flags.push("spike-heart-rate");
    }

    return ApiResponse.ok(
      res,
      {
        insights: {
          status: flags.length ? "attention" : "normal",
          flags,
          latest
        }
      },
      "Behavior insights fetched"
    );
  } catch (err) {
    return next(err);
  }
};

const createAiRiskAssessment = async (req, res, next) => {
  try {
    const { childId } = req.params;
    const { heart_rate_raw, accelerometer_raw, source, imageUrl } = req.body;

    const child = await Child.findById(childId);
    if (!child) {
      return next(new ApiError(404, "Child not found", "NOT_FOUND"));
    }

    const aiPrediction = await invokeAiRiskModel({ heart_rate_raw, accelerometer_raw });

    const assessment = await RiskAssessment.create({
      child: childId,
      source: source || "watch",
      rawPayload: { heart_rate_raw, accelerometer_raw },
      aiResponse: aiPrediction,
      aiModelUrl: process.env.AI_RISK_MODEL_URL
    });

    let alert = null;
    const isDanger =
      aiPrediction.prediction_code === 2 ||
      String(aiPrediction.status_label || "").toUpperCase() === "DANGER";

    if (isDanger) {
      alert = await Alert.create({
        type: "vitals",
        severity: "critical",
        child: childId,
        message: `AI detected danger for ${child.name} (${aiPrediction.confidence_percentage}% confidence)`,
        imageUrl,
        recipients: child.guardians
      });

      assessment.triggeredAlert = alert._id;
      await assessment.save();

      const io = getIo();
      if (io) {
        io.to(`child:${childId}`).emit("alert:new", { alert });
        child.guardians.forEach((guardianId) => {
          io.to(`user:${guardianId.toString()}`).emit("alert:new", { alert });
        });
      }
    }

    return ApiResponse.created(
      res,
      {
        assessment,
        ai_result: aiPrediction,
        alert
      },
      "AI risk assessment processed"
    );
  } catch (err) {
    return next(err);
  }
};

const listAiRiskAssessments = async (req, res, next) => {
  try {
    const { childId } = req.params;

    const child = await Child.findById(childId);
    if (!child) {
      return next(new ApiError(404, "Child not found", "NOT_FOUND"));
    }

    const assessments = await RiskAssessment.find({ child: childId })
      .sort({ createdAt: -1 })
      .limit(100)
      .populate("triggeredAlert");

    return ApiResponse.ok(res, { assessments }, "AI risk assessments fetched", { count: assessments.length });
  } catch (err) {
    return next(err);
  }
};

export { behaviorInsights, createAiRiskAssessment, listAiRiskAssessments };
