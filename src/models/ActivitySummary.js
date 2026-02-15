import mongoose from "mongoose";

const activitySummarySchema = new mongoose.Schema(
  {
    child: { type: mongoose.Schema.Types.ObjectId, ref: "Child", required: true },
    date: { type: Date, required: true },
    steps: { type: Number, default: 0 },
    activeMinutes: { type: Number, default: 0 },
    restMinutes: { type: Number, default: 0 },
    heartRateAvg: { type: Number },
    heartRateMax: { type: Number }
  },
  { timestamps: true }
);

activitySummarySchema.index({ child: 1, date: -1 });

export default mongoose.model("ActivitySummary", activitySummarySchema);
