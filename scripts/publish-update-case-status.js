import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { logger } from "../src/common/logger.js";
/**
 *  call npm run publish:case:status:update to update status of a case
 *  you can add your own caseRef npm run publish:case:status:update <CASE_REF> <WORKFLOW_CODE>
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
  type: "cloud.defra.local.fg-gas-backend.case.update.status",
  datacontenttype: "application/json",
  data: {
    caseRef: "APPLICATION-PMF-001",
    workflowCode: "frps-private-beta",
    newStatus: "OFFERED",
    supplementaryData: {
      phase: null,
      stage: null,
      targetNode: "agreements",
      data: [
        {
          agreementRef: "AGREEMENT-REF-123",
          createdAt: "2023-10-01T12:00:00Z",
          updatedAt: "2023-10-01T12:00:00Z",
          agreementStatus: "OFFERED",
        },
      ],
    },
  },
};

logger.info(
  { queueUrl, component: "cli.publish" },
  "Sending message to SQS queue",
);

if (process.argv.length === 4) {
  logger.info(
    {
      caseRef: process.argv[2],
      workflowCode: process.argv[3],
      component: "cli.publish",
    },
    "Sending sqs case",
  );
  message.data.caseRef = process.argv[2];
  message.data.workflowCode = process.argv[3];
}

if (process.argv.length === 5) {
  const status = process.argv[4];
  logger.info({ status, component: "cli.publish" }, "Setting status");
  message.data.newStatus = status;
  message.data.supplementaryData.data[0].agreementStatus = status;
}

await sqs.send(
  new SendMessageCommand({
    QueueUrl: queueUrl,
    MessageBody: JSON.stringify(message),
    DelaySeconds: 0,
  }),
);

logger.info({ component: "cli.publish" }, "Message sent");
