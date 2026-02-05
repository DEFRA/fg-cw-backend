import { randomUUID } from "node:crypto";
import { setTimeout } from "node:timers/promises";

import { config } from "../../common/config.js";
import { logger } from "../../common/logger.js";
import { withTraceParent } from "../../common/trace-parent.js";
import {
  freeFifoLock,
  getFifoLocks,
  setFifoLock,
} from "../repositories/fifo-lock.repository.js";
import {
  claimEvents,
  findNextMessage,
  processExpiredEvents,
  update,
  updateDeadEvents,
  updateFailedEvents,
  updateResubmittedEvents,
} from "../repositories/inbox.repository.js";
import { createCaseUseCase } from "../use-cases/create-case.use-case.js";
import { handleCaseStatusUpdateUseCase } from "../use-cases/handle-case-status-update.use-case.js";

export const useCaseMap = {
  "cloud.defra.ENV.fg-gas-backend.case.create": createCaseUseCase,
  "cloud.defra.ENV.fg-gas-backend.case.update.status":
    handleCaseStatusUpdateUseCase,
};

export class InboxSubscriber {
  static ACTOR = "INBOX";
  constructor() {
    this.interval = parseInt(config.get("inbox.inboxPollMs"));
    this.running = false;
  }

  async poll() {
    while (this.running) {
      logger.trace("Polling inbox");

      try {
        const claimToken = randomUUID();
        const availableSegregationRef = await this.getNextAvailable();
        if (availableSegregationRef) {
          await setFifoLock(InboxSubscriber.ACTOR, availableSegregationRef);
          const events = await claimEvents(claimToken, availableSegregationRef);
          await this.processEvents(events);
          await freeFifoLock(InboxSubscriber.ACTOR, availableSegregationRef);
        }

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

  async getNextAvailable() {
    const locks = await getFifoLocks(InboxSubscriber.ACTOR);
    const lockIds = locks.map((lock) => lock.segregationRef);
    const available = await findNextMessage(lockIds);
    return available?.segregationRef;
  }

  async processExpiredEvents() {
    const results = await processExpiredEvents();
    results?.modifiedCount &&
      logger.info(`Updated "${results?.modifiedCount}" expired inbox events`);
  }

  async processDeadEvents() {
    const results = await updateDeadEvents();
    results?.modifiedCount &&
      logger.info(`Updated "${results?.modifiedCount}" dead inbox events`);
  }

  async processResubmittedEvents() {
    const results = await updateResubmittedEvents();
    results?.modifiedCount &&
      logger.info(
        `Updated "${results?.modifiedCount}" resubmitted inbox events`,
      );
  }

  async processFailedEvents() {
    const results = await updateFailedEvents();
    results?.modifiedCount &&
      logger.info(`Updated "${results?.modifiedCount}" failed inbox events`);
  }

  async markEventFailed(inboxEvent) {
    inboxEvent.markAsFailed();
    await update(inboxEvent);
    logger.info(`Marked inbox event failed "${inboxEvent.messageId}"`);
  }

  async markEventComplete(inboxEvent) {
    inboxEvent.markAsComplete();
    await update(inboxEvent);
    logger.info(`Marked inbox event as complete "${inboxEvent.messageId}"`);
  }

  async handleEvent(msg) {
    const { type, traceparent, source, messageId } = msg;

    logger.info(`Handling inbox message "${type}:${source}:${messageId}"`);

    try {
      const eventType = type.replace(config.get("cdpEnvironment"), "ENV");
      const handler = useCaseMap[eventType];

      if (!handler) {
        throw new Error(`No handler found for event type ${eventType}`);
      }

      await withTraceParent(traceparent, async () => handler(msg));

      logger.info(
        `Finished: Handling inbox message "${type}:${source}:${messageId}"`,
      );

      await this.markEventComplete(msg);
    } catch (ex) {
      logger.error(ex, `Error handling inbox message "${type}:${messageId}"`);
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
    logger.info("Stopping inbox subscriber");
    this.running = false;
  }
}
