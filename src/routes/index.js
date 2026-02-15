import express from "express";

import authRoutes from "./auth.js";
import userRoutes from "./users.js";
import childRoutes from "./children.js";
import schoolRoutes from "./schools.js";
import deviceRoutes from "./devices.js";
import locationRoutes from "./locations.js";
import alertRoutes from "./alerts.js";
import geofenceRoutes from "./geofences.js";
import activityRoutes from "./activities.js";
import sosRoutes from "./sos.js";
import attendanceRoutes from "./attendance.js";
import analyticsRoutes from "./analytics.js";

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/children", childRoutes);
router.use("/schools", schoolRoutes);
router.use("/devices", deviceRoutes);
router.use("/locations", locationRoutes);
router.use("/alerts", alertRoutes);
router.use("/geofences", geofenceRoutes);
router.use("/activities", activityRoutes);
router.use("/sos", sosRoutes);
router.use("/attendance", attendanceRoutes);
router.use("/analytics", analyticsRoutes);

export default router;
