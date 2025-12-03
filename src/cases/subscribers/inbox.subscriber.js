import { randomUUID } from "node:crypto";
import { setTimeout } from "node:timers/promises";

import { config } from "../../common/config.js";
import { logger } from "../../common/logger.js";
import { withTraceParent } from "../../common/trace-parent.js";
import {
  claimEvents,
  processExpiredEvents,
  update,
  updateDeadEvents,
  updateFailedEvents,
  updateResubmittedEvents,
} from "../repositories/inbox.repository.js";
import { createCaseUseCase } from "../use-cases/create-case.use-case.js";
import { handleAgreementStatusUpdateUseCase } from "../use-cases/handle-agreement-status-update.use-case.js";

export const useCaseMap = {
  "cloud.defra.ENV.fg-gas-backend.case.create": createCaseUseCase,
  "cloud.defra.ENV.fg-gas-backend.case.update.status":
    handleAgreementStatusUpdateUseCase,
};

export class InboxSubscriber {
  constructor() {
    this.interval = parseInt(config.get("inbox.inboxPollMs"));
    this.running = false;
  }

  async poll() {
    while (this.running) {
      logger.trace("Polling inbox");

      try {
        const claimToken = randomUUID();
        const events = await claimEvents(claimToken);

        if (events.length > 0) {
          logger.info("Claimed inbox events", { count: events.length });
        }

        await this.processEvents(events);
        await this.processResubmittedEvents();
        await this.processFailedEvents();
        await this.processDeadEvents();
        await this.processExpiredEvents();
      } catch (error) {
        logger.error(error, "Error polling inbox");
      }

      await setTimeout(this.interval);
    }
  }

  async processExpiredEvents() {
    const results = await processExpiredEvents();
    results?.modifiedCount &&
      logger.info(`Updated ${results?.modifiedCount} expired inbox events`);
  }

  async processDeadEvents() {
    const results = await updateDeadEvents();
    results?.modifiedCount &&
      logger.info(`Updated ${results?.modifiedCount} dead inbox events`);
  }

  async processResubmittedEvents() {
    const results = await updateResubmittedEvents();
    results?.modifiedCount &&
      logger.info(`Updated ${results?.modifiedCount} resubmitted inbox events`);
  }

  async processFailedEvents() {
    const results = await updateFailedEvents();
    results?.modifiedCount &&
      logger.info(`Updated ${results?.modifiedCount} failed inbox events`);
  }

  async markEventFailed(inboxEvent) {
    inboxEvent.markAsFailed();
    await update(inboxEvent);
    logger.info(`Marked inbox event failed ${inboxEvent.messageId}`);
  }

  async markEventComplete(inboxEvent) {
    inboxEvent.markAsComplete();
    await update(inboxEvent);
    logger.info(`Marked inbox event as complete ${inboxEvent.messageId}`);
  }

  async handleEvent(msg) {
    const { type, traceparent, source, messageId } = msg;
    const startTime = Date.now();

    logger.info(
      `Handle event for inbox message ${type}:${source}:${messageId}`,
    );
    try {
      const handlerString = type.replace(config.get("cdpEnvironment"), "ENV");
      const handler = useCaseMap[handlerString];

      if (handler) {
        await withTraceParent(traceparent, async () => handler(msg));
      } else {
        throw new Error(`Unable to handle inbox message ${msg.messageId}`);
      }

      const duration = Date.now() - startTime;
      logger.info("Event handler completed", { messageId, duration });

      await this.markEventComplete(msg);
    } catch (ex) {
      const duration = Date.now() - startTime;
      logger.error(
        `Error handling event for inbox message ${type}:${messageId}`,
      );
      logger.error(ex.message);
      logger.info("Event handler failed", { messageId, duration });
      await this.markEventFailed(msg);
    }
  }

  async processEvents(events) {
    await Promise.all(events.map((event) => this.handleEvent(event)));
  }

  start() {
    logger.info("Starting inbox subscriber");
    this.running = true;
    this.poll();
  }

  stop() {
    logger.info("stopping inbox subscriber");
    this.running = false;
  }
}
