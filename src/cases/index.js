import { up } from "migrate-mongo";
import { registerBucket } from "../common/buckets/registry.js";
import { config } from "../common/config.js";
import { logger } from "../common/logger.js";
import { db, mongoClient } from "../common/mongo-client.js";
import { DeadLetterGauge } from "../events/dead-letter-gauge.js";

import { casesBucket } from "./buckets/cases.bucket.js";
import { inboxBucket } from "./buckets/inbox.bucket.js";
import { outboxBucket } from "./buckets/outbox.bucket.js";
import { workflowsBucket } from "./buckets/workflows.bucket.js";
import { configVersionUpdatedSubscriber } from "./subscribers/config-version-updated.subscriber.js";
import { createNewCaseSubscriber } from "./subscribers/create-new-case.subscriber.js";
import { createUpdateStatusAgreementConsumer } from "./subscribers/update-case-status-agreement.subscriber.js";

import { addNoteToCaseRoute } from "./routes/add-note-to-case.route.js";
import { assignUserToCaseRoute } from "./routes/assign-user-to-case.route.js";
import { findCaseByIdTabIdRoute } from "./routes/find-case-by-id-tab-id.route.js";
import { findCaseByIdRoute } from "./routes/find-case-by-id.route.js";
import { findCasesRoute } from "./routes/find-cases.route.js";
import { dedupePageRoutes } from "./routes/dedupe-page.route.js";
import { countDeadLetters as countInboxDeadLetters } from "./repositories/inbox.repository.js";
import { countDeadLetters as countOutboxDeadLetters } from "./repositories/outbox.repository.js";
import { findCaseTypesRoute } from "./routes/find-case-types.route.js";
import { findWorkflowsRoute } from "./routes/find-workflows.route.js";
import { performPageActionRoute } from "./routes/perform-page-action.route.js";
import { reportCasesRoute } from "./routes/report-cases.route.js";
import { updateStageOutcomeRoute } from "./routes/update-stage-outcome.route.js";
import { updateTaskStatusRoute } from "./routes/update-task-status.route.js";
import { InboxSubscriber } from "./subscribers/inbox.subscriber.js";
import { OutboxSubscriber } from "./subscribers/outbox.subscriber.js";

export const cases = {
  name: "cases",
  async register(server) {
    logger.info("Running migrations");
    const migrated = await up(db, mongoClient);

    migrated.forEach((fileName) => logger.info(`Migrated: "${fileName}"`));
    logger.info("Finished running migrations");

    registerBucket(outboxBucket());
    registerBucket(inboxBucket());
    registerBucket(casesBucket());
    registerBucket(workflowsBucket());

    const outboxSubscriber = new OutboxSubscriber();
    const inboxSubscriber = new InboxSubscriber();
    const deadLetterGauge = new DeadLetterGauge({
      enabled: config.get("metrics.enabled"),
      counts: {
        inbox: countInboxDeadLetters,
        outbox: countOutboxDeadLetters,
      },
    });

    const logStopped = (name) => (error) =>
      logger.error(error, `${name} stopped unexpectedly`);

    server.events.on("start", async () => {
      createNewCaseSubscriber
        .start()
        .catch(logStopped("Create new case subscriber"));
      createUpdateStatusAgreementConsumer
        .start()
        .catch(logStopped("Update case status agreement subscriber"));
      configVersionUpdatedSubscriber
        ?.start()
        .catch(logStopped("Config version updated subscriber"));
      outboxSubscriber.start().catch(logStopped("Outbox subscriber"));
      inboxSubscriber.start();
      deadLetterGauge.start();
    });

    server.events.on("stop", async () => {
      outboxSubscriber.stop();
      inboxSubscriber.stop();
      deadLetterGauge.stop();
      await Promise.all([
        createNewCaseSubscriber.stop(),
        createUpdateStatusAgreementConsumer.stop(),
        configVersionUpdatedSubscriber?.stop(),
      ]);
    });

    server.route([
      ...dedupePageRoutes,
      findCasesRoute,
      findCaseTypesRoute,
      reportCasesRoute,
      findCaseByIdRoute,
      updateStageOutcomeRoute,
      assignUserToCaseRoute,
      addNoteToCaseRoute,
      findWorkflowsRoute,
      updateTaskStatusRoute,
      performPageActionRoute,
      findCaseByIdTabIdRoute,
    ]);
  },
};
