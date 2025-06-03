import sqsConsumerPlugin from "../events/sqs-consumer-plugin.js";
import { createCaseEventHandler } from "../events/create-case-event-handler.js";

export const createCaseEventConsumer = (sqsQueueUrl, server) => ({
  plugin: sqsConsumerPlugin,
  options: {
    queueUrl: sqsQueueUrl,
    handleMessage: createCaseEventHandler(server)
  }
});
