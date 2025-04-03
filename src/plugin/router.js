import { health } from "../route/health.js";
import { cases } from "../route/cases.js";

const router = {
  plugin: {
    name: "router",
    register: (server, _options) => {
      server.route([health].concat(cases));
    }
  }
};

export { router };
