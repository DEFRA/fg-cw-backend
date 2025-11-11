import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { setTimeout } from "node:timers/promises";
import { config } from "../../common/config.js";
import { logger } from "../../common/logger.js";
import { publish } from "../../common/sns-client.js";
import {
  claimEvents,
  update,
  updateDeadEvents,
  updateExpiredEvents,
  updateFailedEvents,
  updateResubmittedEvents,
} from "../repositories/outbox.repository.js";

export class OutboxSubscriber {
  asyncLocalStorage = new AsyncLocalStorage();

  constructor() {
    this.interval = parseInt(config.get("outbox.outboxPollMs"));
    this.running = false;
  }

  async poll() {
    while (this.running) {
      logger.trace("Outbox checking for events.");
      const claimToken = randomUUID();
      const pendingEvents = await claimEvents(claimToken);
      if (pendingEvents?.length > 0) {
        this.asyncLocalStorage.run(claimToken, async () =>
          this.processEvents(pendingEvents),
        );
      }

      await this.processResubmittedEvents();
      await this.processFailedEvents();
      await this.processDeadEvents();
      await this.processExpiredEvents();
      await setTimeout(this.interval);
    }
  }

  async processExpiredEvents() {
    const results = await updateExpiredEvents();
    results?.modifiedCount &&
      logger.info(`Updated ${results.modifiedCount} expired outbox events`);
  }

  async processDeadEvents() {
    const results = await updateDeadEvents();
    results?.modifiedCount &&
      logger.info(`Updated ${results.modifiedCount} dead outbox events`);
  }

  async processResubmittedEvents() {
    const results = await updateResubmittedEvents();
    results?.modifiedCount &&
      logger.info(`Updated ${results.modifiedCount} resubmitted outbox events`);
  }

  async processFailedEvents() {
    const results = await updateFailedEvents();
    results?.modifiedCount &&
      logger.info(`Updated ${results.modifiedCount} failed outbox events`);
  }

  async markEventUnsent(event) {
    const claimedBy = this.asyncLocalStorage.getStore();
    event.markAsFailed();
    await update(event, claimedBy);
    logger.info(`Marked outbox event unsent ${event._id}`);
  }

  async markEventComplete(event) {
    const claimedBy = this.asyncLocalStorage.getStore();
    event.markAsComplete();
    await update(event, claimedBy);
    logger.info(`Marked outbox event as complete: ${event._id}`);
  }

  async sendEvent(event) {
    const { target: topic, event: data } = event;
    logger.info(`Send outbox event to ${topic}`);
    try {
      await publish(topic, data);
      await this.markEventComplete(event);
    } catch (ex) {
      logger.error(`Error sending outbox event to topic ${topic}`);
      logger.error(ex);
      this.markEventUnsent(event);
    }
  }

  async processEvents(events) {
    await Promise.all(events.map((event) => this.sendEvent(event)));
  }

  async start() {
    logger.info("Starting outbox subscriber");
    this.running = true;
    this.poll();
  }

  stop() {
    logger.info("Stopping outbox subscriber");
    this.running = false;
  }
}
