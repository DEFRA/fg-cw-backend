import {
  DeleteMessageCommand,
  ReceiveMessageCommand,
  SQSClient,
} from "@aws-sdk/client-sqs";
import { randomBytes } from "node:crypto";
import { setTimeout } from "node:timers/promises";
import { config } from "./config.js";
import { logger } from "./logger.js";
import { withTraceParent } from "./trace-parent.js";

// W3C traceparent: version 00, 32-hex trace id, 16-hex span id, sampled.
const newTraceParent = () =>
  `00-${randomBytes(16).toString("hex")}-${randomBytes(8).toString("hex")}-01`;

// A Config Broker body is a bare manifest array with no traceparent, so one is
// made up here; it correlates everything downstream but cannot lead back to the
// broker.
export const getOrCreateTraceParent = (body) =>
  body?.traceparent || newTraceParent();

export class SqsSubscriber {
  constructor(options) {
    this.queueUrl = options.queueUrl;
    this.onMessage = options.onMessage;
    this.isRunning = false;
    this.delayOnErrorMs = 250;

    this.sqsClient = new SQSClient({
      region: config.get("aws.region"),
      endpoint: config.get("aws.endpointUrl"),
    });
  }

  async start() {
    this.isRunning = true;
    await this.poll();
  }

  stop() {
    this.isRunning = false;
  }

  async poll() {
    logger.info(`Started polling SQS queue: "${this.queueUrl}"`);

    while (this.isRunning) {
      try {
        const messages = await this.getMessages();
        await Promise.all(messages.map((m) => this.processMessage(m)));
      } catch (err) {
        logger.error(err, `Error polling SQS queue "${this.queueUrl}"`);
        await setTimeout(this.delayOnErrorMs);
      }
    }

    logger.info(`Stopped polling SQS queue: "${this.queueUrl}"`);
  }

  async processMessage(message) {
    let body;

    try {
      body = JSON.parse(message.Body);
    } catch (err) {
      logger.error(
        err,
        `Error parsing SQS message body for message "${message.MessageId}"`,
      );
      return;
    }

    const metadata = {
      messageId: message.MessageId,
      sentTimestamp: message.Attributes?.SentTimestamp,
    };

    await withTraceParent(getOrCreateTraceParent(body), async () => {
      logger.info(`Processing SQS message "${message.MessageId}"`);
      try {
        await this.onMessage(body, message.MessageAttributes, metadata);
        await this.deleteMessage(message);
      } catch (err) {
        logger.error(
          err,
          `Error processing SQS message "${message.MessageId}"`,
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
