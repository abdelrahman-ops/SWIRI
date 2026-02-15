import ActivitySummary from "../models/ActivitySummary.js";

const createSummary = async (req, res, next) => {
  try {
    const { childId, date, steps, activeMinutes, restMinutes, heartRateAvg, heartRateMax } = req.body;
    const summary = await ActivitySummary.findOneAndUpdate(
      { child: childId, date: new Date(date) },
      { steps, activeMinutes, restMinutes, heartRateAvg, heartRateMax },
      { upsert: true, new: true }
    );
    return res.status(201).json({ summary });
  } catch (err) {
    return next(err);
  }
};

const listSummaries = async (req, res, next) => {
  try {
    const summaries = await ActivitySummary.find({ child: req.params.childId }).sort({ date: -1 }).limit(60);
    return res.json({ summaries });
  } catch (err) {
    return next(err);
  }
};

export { createSummary, listSummaries };
