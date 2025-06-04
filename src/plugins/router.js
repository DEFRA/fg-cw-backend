import { health } from "../routes/health.js";
import { cases } from "../routes/cases.js";
import { workflows } from "../routes/workflows.js";
import { caseEvents } from "../routes/case-events.js";

const router = {
  plugin: {
    name: "router",
    register: (server, _options) => {
      server.route([health, ...cases, ...workflows, ...caseEvents]);
    }
  }
};

export { router };
