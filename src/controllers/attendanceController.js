import Attendance from "../models/Attendance.js";

const recordAttendance = async (req, res, next) => {
  try {
    const { childId, schoolId, status, source } = req.body;
    const attendance = await Attendance.create({ child: childId, school: schoolId, status, source });
    return res.status(201).json({ attendance });
  } catch (err) {
    return next(err);
  }
};

const listAttendance = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.schoolId) filter.school = req.query.schoolId;
    if (req.query.childId) filter.child = req.query.childId;
    const records = await Attendance.find(filter).sort({ recordedAt: -1 }).limit(500);
    return res.json({ records });
  } catch (err) {
    return next(err);
  }
};

export { recordAttendance, listAttendance };
