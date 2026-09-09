import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { setTimeout } from "node:timers/promises";

import { config } from "../../common/config.js";
import { logger } from "../../common/logger.js";
import { withTraceParent } from "../../common/trace-parent.js";
import {
  cleanupStaleLocks,
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
import { handleCaseStatusUpdateUseCase } from "../use-cases/handle-case-status-update.use-case.js";
import { submitCaseUseCase } from "../use-cases/submit-case.use-case.js";

export const useCaseMap = {
  "cloud.defra.ENV.fg-gas-backend.case.create": submitCaseUseCase,
  "cloud.defra.ENV.fg-gas-backend.case.update.status":
    handleCaseStatusUpdateUseCase,
};

export class InboxSubscriber {
  asyncLocalStorage = new AsyncLocalStorage();

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
          await this.processWithLock(claimToken, availableSegregationRef);
        }

        await this.processResubmittedEvents();
        await this.processFailedEvents();
        await this.processDeadEvents();
        await this.processExpiredEvents();
        await cleanupStaleLocks(InboxSubscriber.ACTOR);
      } catch (error) {
        logger.error(error, "Error polling inbox");
      }

      await setTimeout(this.interval);
    }
  }

  async processWithLock(claimToken, segregationRef) {
    const lock = await setFifoLock(InboxSubscriber.ACTOR, segregationRef);
    if (lock.upsertedCount === 0 && lock.matchedCount === 0) {
      logger.info(
        `Inbox unable to process lock for segregationRef ${segregationRef}`,
      );
      return;
    }
    try {
      const events = await claimEvents(claimToken, segregationRef);
      // The claim token travels with the work rather than through every
      // handler signature, exactly as the outbox carries it.
      await this.asyncLocalStorage.run(claimToken, async () =>
        this.processEvents(events),
      );
    } finally {
      await freeFifoLock(InboxSubscriber.ACTOR, segregationRef);
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

  // Both writes carry the claim this worker holds, so a handler that outlived
  // its claim writes nothing rather than overwriting the expiry sweep's own
  // accounting. A write that matched nothing says so: the row moved on without
  // this worker, and the numbers on it are not the ones in memory here.
  async writeClaimed(inboxEvent, what) {
    const claimedBy = this.asyncLocalStorage.getStore();
    const result = await update(inboxEvent, claimedBy);

    if (result?.matchedCount === 0) {
      logger.info(
        `Inbox event "${inboxEvent.messageId}" moved on before it was marked ${what}`,
      );

      return;
    }

    logger.info(`Marked inbox event ${what} "${inboxEvent.messageId}"`);
  }

  async markEventFailed(inboxEvent, error) {
    inboxEvent.markAsFailed(error);
    await this.writeClaimed(inboxEvent, "failed");
  }

  async markEventComplete(inboxEvent) {
    inboxEvent.markAsComplete();
    await this.writeClaimed(inboxEvent, "complete");
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
      await this.markEventFailed(msg, ex);
    }
  }

  async processEvents(events) {
    for (const event of events) {
      await this.handleEvent(event);
    }
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
