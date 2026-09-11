import { up } from "migrate-mongo";
import { logger } from "../common/logger.js";
import { db, mongoClient } from "../common/mongo-client.js";

import { configVersionUpdatedSubscriber } from "./subscribers/config-version-updated.subscriber.js";
import { createNewCaseSubscriber } from "./subscribers/create-new-case.subscriber.js";
import { createUpdateStatusAgreementConsumer } from "./subscribers/update-case-status-agreement.subscriber.js";
import { handleCaseStatusUpdateUseCase } from "./use-cases/handle-case-status-update.use-case.js";
import { submitCaseUseCase } from "./use-cases/submit-case.use-case.js";

import { addNoteToCaseRoute } from "./routes/add-note-to-case.route.js";
import { assignUserToCaseRoute } from "./routes/assign-user-to-case.route.js";
import { createWorkflowRoute } from "./routes/create-workflow.route.js";
import { findCaseByIdTabIdRoute } from "./routes/find-case-by-id-tab-id.route.js";
import { findCaseByIdRoute } from "./routes/find-case-by-id.route.js";
import { findCasesRoute } from "./routes/find-cases.route.js";
import { findWorkflowByCodeRoute } from "./routes/find-workflow-by-code.route.js";
import { findWorkflowsRoute } from "./routes/find-workflows.route.js";
import { performPageActionRoute } from "./routes/perform-page-action.route.js";
import { reportCasesRoute } from "./routes/report-cases.route.js";
import { updateStageOutcomeRoute } from "./routes/update-stage-outcome.route.js";
import { updateTaskStatusRoute } from "./routes/update-task-status.route.js";
import { InboxSubscriber } from "../events/subscribers/inbox.subscriber.js";
import { OutboxSubscriber } from "../events/subscribers/outbox.subscriber.js";

const inboxUseCaseMap = {
  "cloud.defra.ENV.fg-gas-backend.case.create": submitCaseUseCase,
  "cloud.defra.ENV.fg-gas-backend.case.update.status":
    handleCaseStatusUpdateUseCase,
};

export const cases = {
  name: "cases",
  async register(server) {
    logger.info("Running migrations");
    const migrated = await up(db, mongoClient);

    migrated.forEach((fileName) => logger.info(`Migrated: "${fileName}"`));
    logger.info("Finished running migrations");

    const outboxSubscriber = new OutboxSubscriber();
    const inboxSubscriber = new InboxSubscriber(inboxUseCaseMap);

    server.events.on("start", async () => {
      createNewCaseSubscriber.start();
      createUpdateStatusAgreementConsumer.start();
      configVersionUpdatedSubscriber?.start();
      outboxSubscriber.start();
      inboxSubscriber.start();
    });

    server.events.on("stop", async () => {
      createNewCaseSubscriber.stop();
      createUpdateStatusAgreementConsumer.stop();
      configVersionUpdatedSubscriber?.stop();
      outboxSubscriber.stop();
      inboxSubscriber.stop();
    });

    server.route([
      findCasesRoute,
      reportCasesRoute,
      findCaseByIdRoute,
      updateStageOutcomeRoute,
      assignUserToCaseRoute,
      addNoteToCaseRoute,
      createWorkflowRoute,
      findWorkflowsRoute,
      findWorkflowByCodeRoute,
      updateTaskStatusRoute,
      performPageActionRoute,
      findCaseByIdTabIdRoute,
    ]);
  },
};
