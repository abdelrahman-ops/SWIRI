import Location from "../models/Location.js";
import Device from "../models/Device.js";
import Child from "../models/Child.js";
import Geofence from "../models/Geofence.js";
import Alert from "../models/Alert.js";
import { distanceMeters } from "../utils/geo.js";
import { isWithinSchedule } from "../utils/schedule.js";
import { getIo } from "../socketStore.js";
import ApiError from "../core/ApiError.js";

const createLocation = async (req, res, next) => {
  try {
    const { childId, deviceId, coordinates, accuracy, speed, heading, recordedAt } = req.body;

    const child = await Child.findById(childId);
    if (!child) {
      return next(new ApiError(404, "Child not found", "NOT_FOUND"));
    }

    const location = await Location.create({
      child: childId,
      device: deviceId,
      coordinates: { type: "Point", coordinates },
      accuracy,
      speed,
      heading,
      recordedAt: recordedAt ? new Date(recordedAt) : undefined
    });

    if (deviceId) {
      await Device.findByIdAndUpdate(deviceId, { lastSeenAt: new Date() });
    }

    const io = getIo();
    if (io) {
      io.to(`child:${childId}`).emit("location:update", { childId, location });
    }

    const geofences = await Geofence.find({ child: childId, active: true });
    for (const fence of geofences) {
      if (!isWithinSchedule(fence.schedule)) {
        continue;
      }
      const dist = distanceMeters(fence.center.coordinates, coordinates);
      if (dist > fence.radiusM) {
        const alert = await Alert.create({
          type: "geofence",
          severity: "high",
          child: childId,
          message: `${child.name} left ${fence.name}`,
          location: { type: "Point", coordinates },
          recipients: child.guardians
        });
        if (io) {
          io.to(`child:${childId}`).emit("alert:new", { alert });
          child.guardians.forEach((guardianId) => {
            io.to(`user:${guardianId.toString()}`).emit("alert:new", { alert });
          });
        }
      }
    }

    return res.status(201).json({ location });
  } catch (err) {
    return next(err);
  }
};

const getLatestLocation = async (req, res, next) => {
  try {
    const location = await Location.findOne({ child: req.params.childId }).sort({ recordedAt: -1 });
    return res.json({ location });
  } catch (err) {
    return next(err);
  }
};

export { createLocation, getLatestLocation };
