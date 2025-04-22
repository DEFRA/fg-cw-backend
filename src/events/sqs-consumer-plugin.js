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

    // Start consuming when the server starts
    server.ext("onPostStart", async () => {
      await consumer.start();
    });

    // Stop consuming when the server stops
    server.ext("onPreStop", async () => {
      await consumer.stop();
    });
  }
};

export default sqsConsumerPlugin;
