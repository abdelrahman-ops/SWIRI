import mongoose from "mongoose";

const calculatedFeaturesSchema = new mongoose.Schema(
  {
    hr_mean: { type: Number },
    hr_gradient: { type: Number },
    acc_mean: { type: Number },
    acc_variance: { type: Number }
  },
  { _id: false }
);

const riskAssessmentSchema = new mongoose.Schema(
  {
    child: { type: mongoose.Schema.Types.ObjectId, ref: "Child", required: true, index: true },
    source: { type: String, enum: ["watch", "band", "manual", "device"], default: "watch" },
    rawPayload: {
      heart_rate_raw: { type: [Number], required: true },
      accelerometer_raw: { type: [Number], required: true }
    },
    aiResponse: {
      prediction_code: { type: Number, required: true },
      confidence_percentage: { type: Number, required: true },
      status_label: { type: String, required: true },
      calculated_features: { type: calculatedFeaturesSchema, default: {} }
    },
    aiModelUrl: { type: String },
    triggeredAlert: { type: mongoose.Schema.Types.ObjectId, ref: "Alert" }
  },
  { timestamps: true }
);

riskAssessmentSchema.index({ child: 1, createdAt: -1 });

export default mongoose.model("RiskAssessment", riskAssessmentSchema);
