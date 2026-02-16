import express from "express";
import Joi from "joi";
import { auth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import {
    behaviorInsights,
    createAiRiskAssessment,
    listAiRiskAssessments
} from "../controllers/analyticsController.js";

const router = express.Router();

router.get(
    "/behavior/:childId",
    auth,
    validate(
        Joi.object({
        body: Joi.object({}),
        params: Joi.object({ childId: Joi.string().required() }).required(),
        query: Joi.object({})
        })
    ),
    behaviorInsights
);

router.post(
    "/ai-risk/:childId",
    auth,
    validate(
        Joi.object({
            body: Joi.object({
                heart_rate_raw: Joi.array().items(Joi.number()).min(3).required(),
                accelerometer_raw: Joi.array().items(Joi.number()).min(3).required(),
                source: Joi.string().valid("watch", "band", "manual", "device").optional(),
                imageUrl: Joi.string().uri().optional()
            }).required(),
            params: Joi.object({ childId: Joi.string().required() }).required(),
            query: Joi.object({})
        })
    ),
    createAiRiskAssessment
);

router.get(
    "/ai-risk/:childId",
    auth,
    validate(
        Joi.object({
            body: Joi.object({}),
            params: Joi.object({ childId: Joi.string().required() }).required(),
            query: Joi.object({})
        })
    ),
    listAiRiskAssessments
);

export default router;
