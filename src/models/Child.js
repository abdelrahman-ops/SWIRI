import mongoose from "mongoose";

const childSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    dateOfBirth: { type: Date },
    guardians: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    school: { type: mongoose.Schema.Types.ObjectId, ref: "School" },
    device: { type: mongoose.Schema.Types.ObjectId, ref: "Device" }
  },
  { timestamps: true }
);

export default mongoose.model("Child", childSchema);
