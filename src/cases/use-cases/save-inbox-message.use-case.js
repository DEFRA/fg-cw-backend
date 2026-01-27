import { logger } from "../../common/logger.js";
import { Inbox } from "../models/inbox.js";
import {
  findByMessageId,
  insertOne,
} from "../repositories/inbox.repository.js";

export const messageSource = {
  Gas: "GAS",
};

export const saveInboxMessageUseCase = async (message, source) => {
  logger.info("Saving inbox message");

  const existing = await findByMessageId(message.id);

  if (existing !== null) {
    logger.warn(`Message with id "${message.id}" already exists`);
    return;
  }

  logger.debug(`Storing message with id "${message.id}".`);

  const inbox = new Inbox({
    traceparent: message.traceparent,
    event: message,
    messageId: message.id,
    type: message.type,
    source,
  });

  await insertOne(inbox);

  logger.info(`Finished: Saving inbox message`);
};
