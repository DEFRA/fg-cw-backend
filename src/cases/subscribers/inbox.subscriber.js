import { randomUUID } from "node:crypto";
import { setTimeout } from "node:timers/promises";

import { config } from "../../common/config.js";
import { logger } from "../../common/logger.js";
import { withTraceParent } from "../../common/trace-parent.js";
import {
  claimEvents,
  update,
  updateDeadEvents,
  updateFailedEvents,
  updateResubmittedEvents,
} from "../repositories/inbox.repository.js";
import { createCaseUseCase } from "../use-cases/create-case.use-case.js";
import { handleAgreementStatusUpdateUseCase } from "../use-cases/handle-agreement-status-update.use-case.js";

export const useCaseMap = {
  "cloud.defra.ENV.fg-gas-backend.application.created": createCaseUseCase,
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
      const claimToken = randomUUID();
      const events = await claimEvents(claimToken);
      await this.processEvents(events);
      await this.processResubmittedEvents();
      await this.processFailedEvents();
      await this.processDeadEvents();

      await setTimeout(this.interval);
    }
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
    logger.info(`Marked inbox event unsent ${inboxEvent.messageId}`);
  }

  async markEventComplete(inboxEvent) {
    inboxEvent.markAsComplete();
    await update(inboxEvent);
    logger.info(`Marked inbox event as complete ${inboxEvent.messageId}`);
  }

  async handleEvent(msg) {
    const { type, traceparent, source, messageId } = msg;
    logger.info(
      `Handle event for inbox message ${type}:${source}:${messageId}`,
    );
    try {
      const handlerString = type.replace(config.get("env"), "ENV");
      const handler = useCaseMap[handlerString];

      if (handler) {
        await withTraceParent(traceparent, async () => handler(msg));
      } else {
        throw new Error(`Unable to handle inbox message ${msg.messageId}`);
      }

      await this.markEventComplete(msg);
    } catch (ex) {
      logger.error(
        `Error handling event for inbox message ${type}:${messageId}`,
      );
      logger.error(ex.message);
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
