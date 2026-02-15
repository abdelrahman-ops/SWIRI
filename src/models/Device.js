import mongoose from "mongoose";

const deviceSchema = new mongoose.Schema(
  {
    serialNumber: { type: String, required: true, unique: true, trim: true },
    type: { type: String, enum: ["watch", "band", "tracker"], default: "watch" },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
    child: { type: mongoose.Schema.Types.ObjectId, ref: "Child" },
    lastSeenAt: { type: Date }
  },
  { timestamps: true }
);

export default mongoose.model("Device", deviceSchema);
