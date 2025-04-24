import SqsConsumer from "./sqs-consumer.js";

const sqsConsumerPlugin = {
  name: "sqs-consumer",
  register: async function (server, options) {
    const consumer = new SqsConsumer(server, {
      queueUrl: options.queueUrl,
      handleMessage: options.handleMessage
    });

    // Register the consumer in server app
    server.app.sqsConsumer = consumer;
  }
};

export default sqsConsumerPlugin;
