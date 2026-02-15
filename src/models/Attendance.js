import mongoose from "mongoose";

const attendanceSchema = new mongoose.Schema(
  {
    child: { type: mongoose.Schema.Types.ObjectId, ref: "Child", required: true },
    school: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true },
    status: { type: String, enum: ["in", "out"], required: true },
    source: { type: String, enum: ["nfc", "ble", "manual"], default: "nfc" },
    recordedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

attendanceSchema.index({ school: 1, recordedAt: -1 });

export default mongoose.model("Attendance", attendanceSchema);
