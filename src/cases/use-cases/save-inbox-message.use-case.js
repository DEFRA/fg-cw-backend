import { getMessageGroupId } from "../../common/get-message-group-id.js";
import { logger } from "../../common/logger.js";
import { Inbox } from "../models/inbox.js";
import {
  findByMessageId,
  insertOne,
} from "../repositories/inbox.repository.js";

export const messageSource = {
  Gas: "GAS",
  ConfigBroker: "CB",
};

export const getSegregationRef = (event) => {
  const { data } = event;
  return getMessageGroupId(null, data);
};

export const saveInboxMessageUseCase = async (
  message,
  source,
  segregationRef,
) => {
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
    // Not a default argument: those evaluate before the body, so a redelivered
    // message with no `data` would throw here rather than at the duplicate check.
    segregationRef: segregationRef ?? getSegregationRef(message),
  });

  await insertOne(inbox);

  logger.info(`Finished: Saving inbox message`);
};
