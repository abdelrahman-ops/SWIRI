import Device from "../models/Device.js";
import Child from "../models/Child.js";

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
      return res.status(404).json({ error: { message: "Device not found", status: 404 } });
    }
    const child = await Child.findById(childId);
    if (!child) {
      return res.status(404).json({ error: { message: "Child not found", status: 404 } });
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
