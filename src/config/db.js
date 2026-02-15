import mongoose from "mongoose";

const connectDb = async (uri) => {
  if (!uri) {
    throw new Error("MONGO_URI is required");
  }

  mongoose.set("strictQuery", true);
  await mongoose.connect(uri, {
    autoIndex: true
  });

  console.log("MongoDB connected");
};

export { connectDb };
