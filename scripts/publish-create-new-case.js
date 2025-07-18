import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";

const sns = new SQSClient({
  region: "eu-west-2",
  endpoint: "http://localhost:4566",
  credentials: {
    accessKeyId: "test",
    secretAccessKey: "test",
  },
});

const queueUrl =
  "http://sqs.eu-west-2.127.0.0.1:4566/000000000000/create_new_case";

const message = {
  id: "event-id-3",
  time: "2025-03-28T11:30:52.000Z",
  source: "fg-gas-backend",
  specversion: "1.0",
  type: "cloud.defra.development.fg-gas-backend.application.created",
  datacontenttype: "application/json",
  data: {
    clientRef: "APPLICATION-REF-3",
    code: "frps-private-beta",
    createdAt: "2025-03-27T10:34:52.000Z",
    submittedAt: "2025-03-28T11:30:52.000Z",
    identifiers: {
      sbi: "SBI001",
      frn: "FIRM0001",
      crn: "CUST0001",
      defraId: "DEFRA0001",
    },
    answers: {
      scheme: "SFI",
      agreementName: "Test application name",
      year: 2025,
      hasCheckedLandIsUpToDate: true,
      actionApplications: [
        {
          parcelId: "9238",
          sheetId: "SX0679",
          code: "CSAM1",
          appliedFor: {
            unit: "ha",
            quantity: 20.23,
          },
        },
      ],
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
