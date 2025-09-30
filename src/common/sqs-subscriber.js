import {
  DeleteMessageCommand,
  ReceiveMessageCommand,
  SQSClient,
} from "@aws-sdk/client-sqs";
import { setTimeout } from "node:timers/promises";
import { config } from "./config.js";
import { logger } from "./logger.js";
import { withTraceParent } from "./trace-parent.js";

export class SqsSubscriber {
  constructor(options) {
    this.queueUrl = options.queueUrl;
    this.onMessage = options.onMessage;
    this.isRunning = false;

    this.sqsClient = new SQSClient({
      region: config.get("aws.region"),
      endpoint: config.get("aws.endpointUrl"),
    });
  }

  async start() {
    this.isRunning = true;
    await this.poll();
  }

  async stop() {
    this.isRunning = false;
  }

  async poll() {
    logger.info(`Started polling SQS queue: ${this.queueUrl}`);

    while (this.isRunning) {
      try {
        const messages = await this.getMessages();
        await Promise.all(messages.map((m) => this.processMessage(m)));
      } catch (err) {
        logger.error({ err }, `Error polling SQS queue ${this.queueUrl}`);
        await setTimeout(30000);
      }
    }

    logger.info(`Stopped polling SQS queue: ${this.queueUrl}`);
  }

  async processMessage(message) {
    let body;

    try {
      body = JSON.parse(message.Body);
    } catch (err) {
      logger.error(
        { err },
        `Error parsing SQS message body for message ${message.MessageId}`,
      );
      return;
    }

    const traceparent = body.traceparent || message.MessageId;

    await withTraceParent(traceparent, async () => {
      logger.info(`Processing SQS message ${message.MessageId}`);
      try {
        await this.onMessage(body);
        await this.deleteMessage(message);
      } catch (err) {
        logger.error(
          { err },
          `Error processing SQS message ${message.MessageId}`,
        );
      }
    });
  }

  async getMessages() {
    const response = await this.sqsClient.send(
      new ReceiveMessageCommand({
        QueueUrl: this.queueUrl,
        MaxNumberOfMessages: 10,
        WaitTimeSeconds: 20,
        AttributeNames: ["All"],
        MessageAttributeNames: ["All"],
      }),
    );

    return response.Messages || [];
  }

  async deleteMessage(message) {
    await this.sqsClient.send(
      new DeleteMessageCommand({
        QueueUrl: this.queueUrl,
        ReceiptHandle: message.ReceiptHandle,
      }),
    );
  }
}
