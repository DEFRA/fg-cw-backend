import { config } from "../../common/config.js";
import { SqsSubscriber } from "../../common/sqs-subscriber.js";
import {
  messageSource,
  saveInboxMessageUseCase,
} from "../use-cases/save-inbox-message.use-case.js";

export const createUpdateStatusAgreementConsumer = new SqsSubscriber({
  queueUrl: config.get("aws.sqs.updateStatusUrl"),
  async onMessage(message) {
    await saveInboxMessageUseCase(message, messageSource.Gas);
  },
});
