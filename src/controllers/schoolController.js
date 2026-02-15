import School from "../models/School.js";

const createSchool = async (req, res, next) => {
  try {
    const { name, address, coordinates } = req.body;
    const school = await School.create({
      name,
      address,
      location: coordinates ? { type: "Point", coordinates } : undefined,
      admin: req.user.id
    });
    return res.status(201).json({ school });
  } catch (err) {
    return next(err);
  }
};

const listSchools = async (req, res, next) => {
  try {
    const schools = await School.find();
    return res.json({ schools });
  } catch (err) {
    return next(err);
  }
};

export { createSchool, listSchools };
