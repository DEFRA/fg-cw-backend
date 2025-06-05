import { caseEvents } from "./routes/case-events.js";
import { casesRoutes } from "./routes/cases.js";
import { workflows } from "./routes/workflows.js";

export const cases = {
  name: "cases",
  register: (server, _options) => {
    server.route([...casesRoutes, ...workflows, ...caseEvents]);
  },
};
