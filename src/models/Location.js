import mongoose from "mongoose";

const locationSchema = new mongoose.Schema(
  {
    child: { type: mongoose.Schema.Types.ObjectId, ref: "Child", required: true },
    device: { type: mongoose.Schema.Types.ObjectId, ref: "Device" },
    coordinates: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number], required: true }
    },
    accuracy: { type: Number },
    speed: { type: Number },
    heading: { type: Number },
    recordedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

locationSchema.index({ coordinates: "2dsphere" });
locationSchema.index({ child: 1, recordedAt: -1 });

export default mongoose.model("Location", locationSchema);
