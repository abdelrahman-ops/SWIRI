import mongoose from "mongoose";

const scheduleSchema = new mongoose.Schema(
  {
    days: { type: [Number], default: [1, 2, 3, 4, 5] },
    start: { type: String, default: "07:00" },
    end: { type: String, default: "16:00" }
  },
  { _id: false }
);

const geofenceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    child: { type: mongoose.Schema.Types.ObjectId, ref: "Child", required: true },
    ownerUser: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    ownerSchool: { type: mongoose.Schema.Types.ObjectId, ref: "School" },
    center: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number], required: true }
    },
    radiusM: { type: Number, required: true },
    schedule: { type: scheduleSchema, default: () => ({}) },
    active: { type: Boolean, default: true }
  },
  { timestamps: true }
);

geofenceSchema.index({ center: "2dsphere" });

export default mongoose.model("Geofence", geofenceSchema);
