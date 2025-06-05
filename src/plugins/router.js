import { caseEvents } from "../routes/case-events.js";
import { cases } from "../routes/cases.js";
import { health } from "../routes/health.js";
import { workflows } from "../routes/workflows.js";

export const router = {
  plugin: {
    name: "router",
    register: (server, _options) => {
      server.route([health, ...cases, ...workflows, ...caseEvents]);
    },
  },
};
