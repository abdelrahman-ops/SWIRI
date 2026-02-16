import mongoose from "mongoose";

let cached = global.__mongooseConn;

const connectDb = async (uri) => {
  if (!uri) {
    throw new Error("MONGO_URI is required");
  }

  // Reuse existing connection in serverless environments
  if (cached && cached.readyState === 1) {
    return cached;
  }

  if (mongoose.connection.readyState === 1) {
    cached = mongoose.connection;
    global.__mongooseConn = cached;
    return cached;
  }

  mongoose.set("strictQuery", true);
  await mongoose.connect(uri, {
    autoIndex: true,
  });

  cached = mongoose.connection;
  global.__mongooseConn = cached;
  console.log("MongoDB connected");
  return cached;
};

export { connectDb };
