import { logger } from "../../common/logger.js";
import { Inbox } from "../models/inbox.js";
import {
  findByMessageId,
  insertOne,
} from "../repositories/inbox.repository.js";

export const messageSource = {
  Gas: "GAS",
};

// eslint-disable-next-line complexity
export const saveInboxMessageUseCase = async (message, source) => {
  const existing = await findByMessageId(message.id);

  logger.info(
    `Save inbox message use case${
      message?.data?.caseRef ? ` for caseRef ${message.data.caseRef}` : ""
    }${
      message?.data?.workflowCode
        ? ` and workflowCode ${message.data.workflowCode}`
        : ""
    } started.`,
  );

  if (existing !== null) {
    // message has already been stored
    logger.warn(`Message with id ${message.id} already exists`);
    return;
  }

  logger.debug(`Storing message with id ${message.id}.`);
  const inbox = new Inbox({
    traceparent: message.traceparent,
    event: message,
    messageId: message.id,
    type: message.type,
    source,
  });

  await insertOne(inbox);

  logger.info("Inbox message saved to database", {
    messageId: message.id,
    type: message.type,
    source,
    status: inbox.status,
  });

  logger.info(
    `Finished: Save inbox message use case${
      message?.data?.caseRef ? ` for caseRef ${message.data.caseRef}` : ""
    }${
      message?.data?.workflowCode
        ? ` and workflowCode ${message.data.workflowCode}`
        : ""
    } started.`,
  );
};
