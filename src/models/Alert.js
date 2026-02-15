import mongoose from "mongoose";

const alertSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["geofence", "sos", "vitals", "movement", "custom"], required: true },
    severity: { type: String, enum: ["low", "medium", "high", "critical"], default: "medium" },
    child: { type: mongoose.Schema.Types.ObjectId, ref: "Child", required: true },
    message: { type: String, required: true },
    location: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number], default: [0, 0] }
    },
    recipients: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    resolved: { type: Boolean, default: false }
  },
  { timestamps: true }
);

alertSchema.index({ location: "2dsphere" });
alertSchema.index({ child: 1, createdAt: -1 });

export default mongoose.model("Alert", alertSchema);
