import { config } from "../../common/config.js";
import { SqsSubscriber } from "../../common/sqs-subscriber.js";
import { saveConfigVersionInboxMessageUseCase } from "../use-cases/save-config-version-inbox-message.use-case.js";

const queueUrl = config.get("aws.sqs.configVersionQueueUrl");

export const configVersionUpdatedSubscriber = queueUrl
  ? new SqsSubscriber({
      queueUrl,
      async onMessage(body, messageAttributes, metadata) {
        await saveConfigVersionInboxMessageUseCase(
          body,
          messageAttributes,
          metadata,
        );
      },
    })
  : null;
