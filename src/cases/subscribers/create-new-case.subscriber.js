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
      messageId: message.id,
    });
    await saveInboxMessageUseCase(message, messageSource.Gas);
  },
});
