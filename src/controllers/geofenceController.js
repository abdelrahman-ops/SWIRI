import Geofence from "../models/Geofence.js";

const createGeofence = async (req, res, next) => {
  try {
    const { name, childId, coordinates, radiusM, schedule } = req.body;
    const geofence = await Geofence.create({
      name,
      child: childId,
      center: { type: "Point", coordinates },
      radiusM,
      schedule,
      ownerUser: req.user.role === "parent" ? req.user.id : undefined,
      ownerSchool: req.user.role === "school" ? req.user.school : undefined
    });
    return res.status(201).json({ geofence });
  } catch (err) {
    return next(err);
  }
};

const listGeofences = async (req, res, next) => {
  try {
    const filter = req.query.childId ? { child: req.query.childId } : {};
    const geofences = await Geofence.find(filter).sort({ createdAt: -1 });
    return res.json({ geofences });
  } catch (err) {
    return next(err);
  }
};

export { createGeofence, listGeofences };
