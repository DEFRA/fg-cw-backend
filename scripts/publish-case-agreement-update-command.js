import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";

/**
 *  call npm run publish:case:agreement to publish agreement command
 *  you can add your own caseRef npm run publish:case:agreement <CASE_REF> <WORKFLOW_CODE>
 *  optionally you can set the status also to OFFERED, OFFER_ACCEPTED, OFFER_WITHDRAWN
 */

const sqs = new SQSClient({
  region: "eu-west-2",
  endpoint: "http://localhost:4566",
  credentials: {
    accessKeyId: "test",
    secretAccessKey: "test",
  },
});

const queueUrl =
  "http://sqs.eu-west-2.127.0.0.1:4566/000000000000/cw__sqs__update_case_status";

const message = {
  id: "event-id-4",
  time: "2025-03-28T11:30:52.000Z",
  source: "fg-gas-backend",
  specversion: "1.0",
  type: "cloud.defra.development.fg-gas-backend.application.agreement",
  datacontenttype: "application/json",
  data: {
    caseRef: "APPLICATION-PMF-001",
    workflowCode: "pigs-might-fly",
    newStatus: "OFFERED",
    supplementaryData: {
      phase: null,
      stage: null,
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

// customise clientRef
if (process.argv.length === 4) {
  console.log(
    "Sending sqs case for " + process.argv[2] + " " + process.argv[3],
  );
  message.data.caseRef = process.argv[2];
  message.data.workflowCode = process.argv[3];
}

if (process.argv.length === 5) {
  const status = process.argv[4];
  console.log("Setting status to " + status);
  message.data.newStatus = status;
  message.data.supplementaryData.data.agreementStatus = status;
}

await sqs.send(
  new SendMessageCommand({
    QueueUrl: queueUrl,
    MessageBody: JSON.stringify(message),
    DelaySeconds: 0,
  }),
);

console.log("Message sent");
