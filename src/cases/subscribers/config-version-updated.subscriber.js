import { config } from "../../common/config.js";
import { logger } from "../../common/logger.js";
import { SqsSubscriber } from "../../common/sqs-subscriber.js";
import { processConfigVersionUseCase } from "../use-cases/process-config-version.use-case.js";

const queueUrl = config.get("aws.sqs.configVersionQueueUrl");

const extractStringAttribute = (attributes, key) =>
  attributes?.[key]?.StringValue;

export const configVersionUpdatedSubscriber = queueUrl
  ? new SqsSubscriber({
      queueUrl,
      async onMessage(body, messageAttributes) {
        const grantCode = extractStringAttribute(messageAttributes, "grant");
        const version = extractStringAttribute(messageAttributes, "version");
        const status = extractStringAttribute(messageAttributes, "status");
        const manifest = body;

        logger.info(
          `Received config version update: ${grantCode}@${version} (${status})`,
        );

        await processConfigVersionUseCase({
          grantCode,
          version,
          status,
          manifest,
        });
      },
    })
  : null;
