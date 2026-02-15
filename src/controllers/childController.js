import Child from "../models/Child.js";
import User from "../models/User.js";

const createChild = async (req, res, next) => {
  try {
    const { name, dateOfBirth, schoolId, guardianIds } = req.body;
    const guardians = guardianIds?.length ? guardianIds : [req.user.id];
    const child = await Child.create({ name, dateOfBirth, school: schoolId, guardians });
    await User.updateMany({ _id: { $in: guardians } }, { $addToSet: { children: child.id } });
    return res.status(201).json({ child });
  } catch (err) {
    return next(err);
  }
};

const listChildren = async (req, res, next) => {
  try {
    const query = req.user.role === "school" ? { school: req.user.school } : { guardians: req.user.id };
    const children = await Child.find(query).populate("guardians school device");
    return res.json({ children });
  } catch (err) {
    return next(err);
  }
};

const getChild = async (req, res, next) => {
  try {
    const child = await Child.findById(req.params.childId).populate("guardians school device");
    if (!child) {
      return res.status(404).json({ error: { message: "Child not found", status: 404 } });
    }
    return res.json({ child });
  } catch (err) {
    return next(err);
  }
};

const updateChild = async (req, res, next) => {
  try {
    const updates = {
      name: req.body.name,
      dateOfBirth: req.body.dateOfBirth,
      school: req.body.schoolId
    };
    const child = await Child.findByIdAndUpdate(req.params.childId, updates, { new: true });
    if (!child) {
      return res.status(404).json({ error: { message: "Child not found", status: 404 } });
    }
    return res.json({ child });
  } catch (err) {
    return next(err);
  }
};

export { createChild, listChildren, getChild, updateChild };
