import Device from "../models/Device.js";
import Child from "../models/Child.js";
import ApiError from "../core/ApiError.js";

const registerDevice = async (req, res, next) => {
  try {
    const { serialNumber, type } = req.body;
    const device = await Device.create({ serialNumber, type });
    return res.status(201).json({ device });
  } catch (err) {
    return next(err);
  }
};

const assignDevice = async (req, res, next) => {
  try {
    const { childId } = req.body;
    const device = await Device.findById(req.params.deviceId);
    if (!device) {
      return next(new ApiError(404, "Device not found", "NOT_FOUND"));
    }
    const child = await Child.findById(childId);
    if (!child) {
      return next(new ApiError(404, "Child not found", "NOT_FOUND"));
    }
    device.child = child.id;
    await device.save();
    child.device = device.id;
    await child.save();
    return res.json({ device, child });
  } catch (err) {
    return next(err);
  }
};

const listDevices = async (req, res, next) => {
  try {
    const devices = await Device.find().populate("child");
    return res.json({ devices });
  } catch (err) {
    return next(err);
  }
};

export { registerDevice, assignDevice, listDevices };
