import sqsConsumerPlugin from "../events/sqs-consumer-plugin.js";
import { createCaseEventHandler } from "../events/create-case-event-handler.js";

const createCaseEventConsumer = (sqsQueueUrl, server) => ({
  plugin: sqsConsumerPlugin,
  options: {
    queueUrl: sqsQueueUrl,
    handleMessage: createCaseEventHandler(server)
  }
});
export { createCaseEventConsumer };
