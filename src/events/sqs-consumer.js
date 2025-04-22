import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand
} from "@aws-sdk/client-sqs";
import { config } from "../config.js";

export default class SqsConsumer {
  constructor(server, options) {
    this.server = server;
    this.queueUrl = options.queueUrl;
    this.handleMessage = options.handleMessage;
    this.isRunning = false;

    // Configure SQS client
    this.sqsClient = new SQSClient({
      endpoint: config.get("aws.sqsEndpoint") || "http://localhost:4566",
      region: config.get("aws.awsRegion") || "eu-west-2",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "test",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "test"
      }
    });
  }

  async start() {
    this.isRunning = true;
    await this.poll();
    this.server.logger.info(`Started polling SQS queue: ${this.queueUrl}`);
  }

  async stop() {
    this.isRunning = false;
    this.server.logger.info(`Stopped polling SQS queue: ${this.queueUrl}`);
  }

  async poll() {
    while (this.isRunning) {
      try {
        const receiveParams = {
          QueueUrl: this.queueUrl,
          MaxNumberOfMessages: 10,
          WaitTimeSeconds: 20, // Long polling - wait up to 20 seconds for messages
          AttributeNames: ["All"],
          MessageAttributeNames: ["All"]
        };

        const command = new ReceiveMessageCommand(receiveParams);
        const response = await this.sqsClient.send(command);

        if (response.Messages && response.Messages.length > 0) {
          await Promise.all(
            response.Messages.map(async (message) => {
              try {
                // Process the message
                await this.handleMessage(message);
                // Delete the message after successful processing
                await this.deleteMessage(message);
              } catch (err) {
                this.server.logger.error({
                  error: err.message,
                  message: "Failed to process SQS message",
                  messageId: message.MessageId
                });
              }
            })
          );
        }
      } catch (err) {
        this.server.logger.error({
          error: err.message,
          message: "Error polling SQS queue"
        });
        // Add a small delay before retrying on error
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }

  async deleteMessage(message) {
    const deleteParams = {
      QueueUrl: this.queueUrl,
      ReceiptHandle: message.ReceiptHandle
    };

    const command = new DeleteMessageCommand(deleteParams);
    await this.sqsClient.send(command);
  }
}
