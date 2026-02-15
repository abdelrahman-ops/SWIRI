import mongoose from "mongoose";

const schoolSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    address: { type: String, trim: true },
    admin: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    location: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number], default: [0, 0] }
    }
  },
  { timestamps: true }
);

schoolSchema.index({ location: "2dsphere" });

export default mongoose.model("School", schoolSchema);
