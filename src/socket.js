import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import User from "./models/User.js";
import { setIo } from "./socketStore.js";

const setupSocket = (server) => {
    const io = new Server(server, {
        cors: {
        origin: (process.env.CORS_ORIGINS || "").split(",").map((v) => v.trim()).filter(Boolean),
        credentials: true
        }
    });

    io.use(async (socket, next) => {
        try {
        const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace("Bearer ", "");
        if (!token) {
            return next(new Error("Unauthorized"));
        }
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(payload.sub).populate("children");
        if (!user) {
            return next(new Error("Unauthorized"));
        }
        socket.user = user;
        return next();
        } catch (err) {
        return next(new Error("Unauthorized"));
        }
    });

    io.on("connection", (socket) => {
        const user = socket.user;
        socket.join(`user:${user.id}`);

        if (user.children?.length) {
        user.children.forEach((child) => {
            socket.join(`child:${child.id}`);
        });
        }

        if (user.school) {
        socket.join(`school:${user.school.toString()}`);
        }
    });

    setIo(io);
    return io;
};

export { setupSocket };
