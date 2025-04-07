import { health } from "../route/health.js";
import { cases } from "../route/cases.js";
import { workflows } from "../route/workflows.js";

const router = {
  plugin: {
    name: "router",
    register: (server, _options) => {
      server.route([health, ...cases, ...workflows]);
    }
  }
};

export { router };
