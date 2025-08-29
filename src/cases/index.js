import { up } from "migrate-mongo";
import { logger } from "../common/logger.js";
import { db, mongoClient } from "../common/mongo-client.js";

import { createNewCaseSubscriber } from "./subscribers/create-new-case.subscriber.js";

import { addNoteToCaseRoute } from "./routes/add-note-to-case.route.js";
import { assignUserToCaseRoute } from "./routes/assign-user-to-case.route.js";
import { createWorkflowRoute } from "./routes/create-workflow.route.js";
import { findCaseByIdRoute } from "./routes/find-case-by-id.route.js";
import { findCasesRoute } from "./routes/find-cases.route.js";
import { findWorkflowByCodeRoute } from "./routes/find-workflow-by-code.route.js";
import { findWorkflowsRoute } from "./routes/find-workflows.route.js";
import { updateStageOutcomeRoute } from "./routes/update-stage-outcome.route.js";
import { updateTaskStatusRoute } from "./routes/update-task-status.route.js";

export const cases = {
  name: "cases",
  async register(server) {
    logger.info("Running DB Migrations");
    await up(db, mongoClient);
    logger.info("Finished running DB Migrations");

    server.events.on("start", async () => {
      await createNewCaseSubscriber.start();
    });

    server.events.on("stop", async () => {
      await createNewCaseSubscriber.stop();
    });

    server.route([
      findCasesRoute,
      findCaseByIdRoute,
      updateStageOutcomeRoute,
      assignUserToCaseRoute,
      addNoteToCaseRoute,
      createWorkflowRoute,
      findWorkflowsRoute,
      findWorkflowByCodeRoute,
      updateTaskStatusRoute,
    ]);
  },
};
