import { config } from "../../common/config.js";
import { logger } from "../../common/logger.js";
import { SqsSubscriber } from "../../common/sqs-subscriber.js";
import {
  messageSource,
  saveInboxMessageUseCase,
} from "../use-cases/save-inbox-message.use-case.js";

export const createNewCaseSubscriber = new SqsSubscriber({
  queueUrl: config.get("aws.sqs.createNewCaseUrl"),
  async onMessage(message) {
    logger.info("createNewCaseSubscriber received message", {
      type: message.type,
      messageId: message.id,
      source: message.source,
    });
    await saveInboxMessageUseCase(message, messageSource.Gas);
  },
});
