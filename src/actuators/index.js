import { findBoxesRoute } from "./routes/find-boxes.route.js";

export const actuators = {
  name: "actuators",
  register(server) {
    server.route([findBoxesRoute]);
  },
};
