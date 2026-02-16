import mongoose from "mongoose";

const sosEventSchema = new mongoose.Schema(
  {
    child: { type: mongoose.Schema.Types.ObjectId, ref: "Child", required: true },
    triggeredBy: { type: String, enum: ["child", "device", "auto"], default: "child" },
    status: { type: String, enum: ["active", "resolved"], default: "active" },
    location: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number], default: [0, 0] }
    },
    imageUrl: { type: String },
    resolvedAt: { type: Date }
  },
  { timestamps: true }
);

sosEventSchema.index({ child: 1, createdAt: -1 });

export default mongoose.model("SosEvent", sosEventSchema);
