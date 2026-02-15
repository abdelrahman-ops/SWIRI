import SosEvent from "../models/SosEvent.js";
import Alert from "../models/Alert.js";
import Child from "../models/Child.js";
import { getIo } from "../socketStore.js";
import ApiError from "../core/ApiError.js";

const triggerSos = async (req, res, next) => {
  try {
    const { childId, triggeredBy, coordinates } = req.body;
    const child = await Child.findById(childId);
    if (!child) {
      return next(new ApiError(404, "Child not found", "NOT_FOUND"));
    }

    const event = await SosEvent.create({
      child: childId,
      triggeredBy,
      location: coordinates ? { type: "Point", coordinates } : undefined
    });

    const alert = await Alert.create({
      type: "sos",
      severity: "critical",
      child: childId,
      message: `SOS triggered for ${child.name}`,
      location: coordinates ? { type: "Point", coordinates } : undefined,
      recipients: child.guardians
    });

    const io = getIo();
    if (io) {
      io.to(`child:${childId}`).emit("sos:new", { event, alert });
      child.guardians.forEach((guardianId) => {
        io.to(`user:${guardianId.toString()}`).emit("sos:new", { event, alert });
      });
    }

    return res.status(201).json({ event, alert });
  } catch (err) {
    return next(err);
  }
};

const resolveSos = async (req, res, next) => {
  try {
    const event = await SosEvent.findByIdAndUpdate(
      req.params.sosId,
      { status: "resolved", resolvedAt: new Date() },
      { new: true }
    );
    if (!event) {
      return next(new ApiError(404, "SOS not found", "NOT_FOUND"));
    }
    return res.json({ event });
  } catch (err) {
    return next(err);
  }
};

export { triggerSos, resolveSos };
