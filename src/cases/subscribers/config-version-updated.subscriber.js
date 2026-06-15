import { config } from "../../common/config.js";
import { SqsSubscriber } from "../../common/sqs-subscriber.js";
import {
  messageSource,
  saveInboxMessageUseCase,
} from "../use-cases/save-inbox-message.use-case.js";

const queueUrl = config.get("aws.sqs.configVersionQueueUrl");

export const configVersionUpdatedSubscriber = queueUrl
  ? new SqsSubscriber({
      queueUrl,
      async onMessage(message) {
        await saveInboxMessageUseCase(message, messageSource.ConfigBroker);
      },
    })
  : null;
