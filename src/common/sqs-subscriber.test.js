import { createHash } from "node:crypto";
import http from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { logger } from "./logger.js";
import { SqsSubscriber } from "./sqs-subscriber.js";

vi.mock("./logger.js", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("./config.js", () => ({
  config: {
    get: vi.fn(
      (key) =>
        ({
          "aws.endpointUrl": "http://localhost:3366",
          "aws.region": "eu-west-2",
        })[key],
    ),
  },
}));

const createMd5 = (str) => createHash("md5").update(str).digest("hex");

const mockSqs = () => {
  let messages = [
    {
      MessageId: "19dd0b57-b21e-4ac1-bd88-01bbb068cb78",
      ReceiptHandle: "AQEBwJnK_mock_receipt_handle_123",
      Body: JSON.stringify({
        orderId: "12345",
        status: "pending",
        timestamp: "2025-09-29T14:00:00Z",
      }),
      Attributes: {
        SenderId: "123456789012",
        ApproximateFirstReceiveTimestamp: "1695993600001",
        ApproximateReceiveCount: "1",
        SentTimestamp: "1695993600000",
      },
      MessageAttributes: {
        Priority: {
          DataType: "String",
          StringValue: "High",
        },
      },
    },
    {
      MessageId: "29dd0b57-b21e-4ac1-bd88-01bbb068cb79",
      ReceiptHandle: "AQEBwJnK_mock_receipt_handle_124",
      Body: JSON.stringify({
        orderId: "67890",
        status: "shipped",
        timestamp: "2025-09-29T15:00:00Z",
      }),
      Attributes: {
        SenderId: "123456789012",
        ApproximateFirstReceiveTimestamp: "1695997200001",
        ApproximateReceiveCount: "1",
        SentTimestamp: "1695997200000",
      },
      MessageAttributes: {
        Priority: {
          DataType: "String",
          StringValue: "Low",
        },
      },
    },
  ].map((msg) => ({
    ...msg,
    MD5OfBody: createMd5(msg.Body),
    visible: true,
  }));

  const server = http.createServer((req, res) => {
    let body = "";

    req.on("data", (chunk) => (body += chunk));

    req.on("end", () => {
      const payload = JSON.parse(body);

      if (payload.MaxNumberOfMessages) {
        const visibleMessages = messages.filter((m) => m.visible);
        visibleMessages.forEach((m) => (m.visible = false));

        res.writeCode = 200;
        res.end(
          JSON.stringify({
            Messages: visibleMessages,
          }),
        );
        return;
      }

      if (payload.ReceiptHandle) {
        messages = messages.filter(
          (m) => m.ReceiptHandle !== payload.ReceiptHandle,
        );

        res.writeCode = 200;
        res.end(JSON.stringify({}));
        return;
      }

      res.writeCode = 400;
      res.end();
    });
  });

  server.listen(3366);

  return server;
};

describe("SqsSubscriber", () => {
  let sqs;

  beforeEach(() => {
    sqs = mockSqs();
  });

  afterEach(() => {
    sqs.close();
  });

  it("polls and processes messages", async () => {
    const messages = [];

    const subscriber = new SqsSubscriber({
      queueUrl: "http://localhost:3366/000000000000/test-queue",
      async onMessage(msg) {
        messages.push(msg);
      },
    });

    subscriber.start();

    await subscriber.stop();

    await expect
      .poll(() => messages)
      .toEqual([
        {
          orderId: "12345",
          status: "pending",
          timestamp: "2025-09-29T14:00:00Z",
        },
        {
          orderId: "67890",
          status: "shipped",
          timestamp: "2025-09-29T15:00:00Z",
        },
      ]);
  });

  it("logs errors and continues polling", async () => {
    const subscriber = new SqsSubscriber({
      queueUrl: "http://localhost:3366/000000000000/test-queue",
      async onMessage() {
        throw new Error("Processing error");
      },
    });

    subscriber.start();

    await subscriber.stop();

    await expect
      .poll(() => logger.error)
      .toHaveBeenCalledWith(
        new Error("Processing error"),
        'Error processing SQS message "19dd0b57-b21e-4ac1-bd88-01bbb068cb78"',
      );
  });
});
