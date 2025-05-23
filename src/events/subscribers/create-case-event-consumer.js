import sqsConsumerPlugin from "./sqs-consumer-plugin.js";
import { createCaseEventHandler } from "../handlers/create-case-event-handler.js";

const createCaseEventConsumer = (sqsQueueUrl, server) => ({
  plugin: sqsConsumerPlugin,
  options: {
    queueUrl: sqsQueueUrl,
    handleMessage: createCaseEventHandler(server)
  }
});
export { createCaseEventConsumer };
