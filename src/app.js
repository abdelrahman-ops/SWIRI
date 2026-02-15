import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";

import apiRouter from "./routes/index.js";
import ApiResponse from "./core/ApiResponse.js";
import { requestContext } from "./middleware/requestContext.js";
import { responseEnvelope } from "./middleware/responseEnvelope.js";
import { notFound } from "./middleware/notFound.js";
import { errorHandler } from "./middleware/errorHandler.js";

const app = express();

const origins = (process.env.CORS_ORIGINS || "").split(",").map((v) => v.trim()).filter(Boolean);

app.use(helmet());
app.use(cors({ origin: origins.length ? origins : true, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));
app.use(requestContext);
app.use(responseEnvelope);
app.use(
    rateLimit({
        windowMs: 60 * 1000,
        max: 120,
        standardHeaders: true,
        legacyHeaders: false
    })
);

app.get("/health", (req, res) => {
    return ApiResponse.ok(res, { status: "ok", service: "swiri" }, "Service health is good");
});

app.use("/api", apiRouter);

app.use(notFound);

app.use(errorHandler);

export default app;
