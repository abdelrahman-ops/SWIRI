import Alert from "../models/Alert.js";
import { getIo } from "../socketStore.js";

const listAlerts = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.childId) filter.child = req.query.childId;
    const alerts = await Alert.find(filter).sort({ createdAt: -1 }).limit(200);
    return res.json({ alerts });
  } catch (err) {
    return next(err);
  }
};

const createAlert = async (req, res, next) => {
  try {
    const { type, severity, childId, message, coordinates, recipients, imageUrl } = req.body;
    const alert = await Alert.create({
      type,
      severity,
      child: childId,
      message,
      location: coordinates ? { type: "Point", coordinates } : undefined,
      imageUrl,
      recipients
    });

    const io = getIo();
    if (io) {
      io.to(`child:${childId}`).emit("alert:new", { alert });
      (recipients || []).forEach((userId) => {
        io.to(`user:${userId.toString()}`).emit("alert:new", { alert });
      });
    }

    return res.status(201).json({ alert });
  } catch (err) {
    return next(err);
  }
};

export { listAlerts, createAlert };
