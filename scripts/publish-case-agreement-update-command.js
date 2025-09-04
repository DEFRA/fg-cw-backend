import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";

/**
 *  call npm run publish:case:agreement to publish agreemenet command
 */

const sns = new SQSClient({
  region: "eu-west-2",
  endpoint: "http://localhost:4566",
  credentials: {
    accessKeyId: "test",
    secretAccessKey: "test",
  },
});

const queueUrl =
  "http://sqs.eu-west-2.127.0.0.1:4566/000000000000/cw__sns__case_status_updated";

const message = {
  id: "event-id-4",
  time: "2025-03-28T11:30:52.000Z",
  source: "fg-gas-backend",
  specversion: "1.0",
  type: "cloud.defra.development.fg-gas-backend.application.agreement",
  datacontenttype: "application/json",
  data: {
    clientRef: "APPLICATION-PMF-001",
    newStatus: "REVIEW",
    supplementaryData: {
      phase: "PRE_AWARD",
      stage: "AWARD",
      targetNode: "agreements",
      data: {
        agreementRef: "AGREEMENT-REF-123",
        createdAt: "2023-10-01T12:00:00Z",
        agreementStatus: "OFFERED",
      },
    },
  },
};

console.log("Sending message to SQS queue:", queueUrl);

await sns.send(
  new SendMessageCommand({
    QueueUrl: queueUrl,
    MessageBody: JSON.stringify(message),
    DelaySeconds: 0,
  }),
);

console.log("Message sent");
