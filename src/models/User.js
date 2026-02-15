import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    phone: { type: String, trim: true, unique: true, sparse: true },
    termsAcceptedAt: { type: Date },
    authProvider: { type: String, enum: ["password", "google"], default: "password" },
    role: { type: String, enum: ["parent", "school", "staff", "admin", "driver"], default: "parent" },
    school: { type: mongoose.Schema.Types.ObjectId, ref: "School" },
    children: [{ type: mongoose.Schema.Types.ObjectId, ref: "Child" }]
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
