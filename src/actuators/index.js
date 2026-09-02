import { findInboxRoute } from "./routes/find-inbox.route.js";
import { findOutboxRoute } from "./routes/find-outbox.route.js";

export const actuators = {
  name: "actuators",
  register(server) {
    server.route([findInboxRoute, findOutboxRoute]);
  },
};
