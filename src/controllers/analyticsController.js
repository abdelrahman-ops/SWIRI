import ActivitySummary from "../models/ActivitySummary.js";

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

    return res.json({
      insights: {
        status: flags.length ? "attention" : "normal",
        flags,
        latest
      }
    });
  } catch (err) {
    return next(err);
  }
};

export { behaviorInsights };
