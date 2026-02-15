import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import createError from "http-errors";

import apiRouter from "./routes/index.js";

const app = express();

const origins = (process.env.CORS_ORIGINS || "").split(",").map((v) => v.trim()).filter(Boolean);

app.use(helmet());
app.use(cors({ origin: origins.length ? origins : true, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false
  })
);

app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "swiri" });
});

app.use("/api", apiRouter);

app.use((req, res, next) => {
  next(createError(404, "Not Found"));
});

app.use((err, req, res, next) => {
  const status = err.status || 500;
  res.status(status).json({
    error: {
      message: err.message || "Server error",
      status
    }
  });
});

export default app;
