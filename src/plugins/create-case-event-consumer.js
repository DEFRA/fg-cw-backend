import { createCaseEventHandler } from "../events/create-case-event-handler.js";
import { sqsConsumerPlugin } from "../events/sqs-consumer-plugin.js";

export const createCaseEventConsumer = (sqsQueueUrl, server) => ({
  plugin: sqsConsumerPlugin,
  options: {
    queueUrl: sqsQueueUrl,
    handleMessage: createCaseEventHandler(server),
  },
});
