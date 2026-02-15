import "dotenv/config";
import http from "http";
import app from "./app.js";
import { connectDb } from "./config/db.js";
import { setupSocket } from "./socket.js";

const PORT = process.env.PORT || 4000;

(async () => {
  await connectDb(process.env.MONGO_URI);

  const server = http.createServer(app);
  setupSocket(server);

  server.listen(PORT, () => {
    console.log(`Swiri backend listening on port ${PORT}`);
  });
})();
