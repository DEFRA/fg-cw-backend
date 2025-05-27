import { health } from "../route/health/health.js";
import { cases } from "../route/case/cases.js";
import { workflows } from "../route/workflows/workflows.js";
import { caseEvents } from "../route/case/case-events.js";
import { createCaseRoute } from "../route/case/create-case.route.js";

const router = {
  plugin: {
    name: "router",
    register: (server, _options) => {
      server.route([
        health,
        ...cases,
        ...workflows,
        ...caseEvents,
        createCaseRoute
      ]);
    }
  }
};

export { router };
