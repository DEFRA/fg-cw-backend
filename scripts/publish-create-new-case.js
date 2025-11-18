import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { randomUUID } from "node:crypto";
import { logger } from "../src/common/logger.js";
/**
 *  call npm run publish:case:new to create a case for frps-private-beta
 *  call npm run publish:case:pmf to create a case for pigs-might-fly
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
  "http://sqs.eu-west-2.127.0.0.1:4566/000000000000/cw__sqs__create_new_case";

const messagePmf = {
  id: randomUUID(),
  time: "2025-03-28T11:30:52.000Z",
  source: "fg-gas-backend",
  specversion: "1.0",
  type: "cloud.defra.local.fg-gas-backend.case.create",
  datacontenttype: "application/json",
  traceparent: randomUUID(),
  data: {
    caseRef: Math.random().toString(30).substring(2, 9),
    workflowCode: "pigs-might-fly",
    status: "NEW",
    payload: {
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
  },
};

const messageFrps = {
  id: randomUUID(),
  time: "2025-03-28T11:30:52.000Z",
  source: "fg-gas-backend",
  specversion: "1.0",
  type: "cloud.defra.local.fg-gas-backend.case.create",
  datacontenttype: "application/json",
  traceparent: randomUUID(),
  data: {
    caseRef: Math.random().toString(30).substring(2, 9),
    workflowCode: "frps-private-beta",
    status: "NEW",
    payload: {
      createdAt: "2025-03-27T10:34:52.000Z",
      submittedAt: "2025-03-28T11:30:52.000Z",
      identifiers: {
        sbi: "SBI001",
        frn: "FIRM0001",
        crn: "CUST0001",
        defraId: "DEFRA0001",
      },
      answers: {
        applicationValidationRunId: "123",
        scheme: "SFI",
        applicant: {
          business: {
            reference: "1101313269",
            email: { address: "griffinmrm@rmniffirgr.com.test" },
            phone: { mobile: "01234031670" },
            name: "Berkshire Estate Limited",
            address: {
              line1: "Lang Cottage",
              line2: "Eastfield House",
              line3: "Haute Vienne",
              line4: null,
              line5: null,
              street: "FAIRVIEW CRESCENT",
              city: "SELBY",
              postalCode: "TR12 7AZ",
            },
          },
          customer: {
            name: {
              title: "Mrs",
              first: "Bernard",
              middle: null,
              last: "Tarrant",
            },
          },
        },
        parcels: [
          {
            sheetId: "AB1234",
            parcelId: "10001",
            area: {
              unit: "ha",
              quantity: 10.0,
            },
            actions: [
              {
                code: "CMOR1",
                description: "Assess moorland and produce a written record",
                durationYears: 3,
                eligible: {
                  unit: "ha",
                  quantity: 7.5,
                },
                appliedFor: {
                  unit: "ha",
                  quantity: 7.5,
                },
                paymentRates: {
                  ratePerUnitPence: 1060,
                  agreementLevelAmountPence: 27200,
                },
                annualPaymentPence: 35150,
              },
            ],
          },
          {
            sheetId: "DX1234",
            parcelId: "10002",
            area: {
              unit: "ha",
              quantity: 10.0,
            },
            actions: [
              {
                code: "UPL1",
                description: "Assess moorland and produce a written record",
                durationYears: 3,
                eligible: {
                  unit: "ha",
                  quantity: 7.5,
                },
                appliedFor: {
                  unit: "ha",
                  quantity: 7.5,
                },
                paymentRates: {
                  ratePerUnitPence: 1060,
                  agreementLevelAmountPence: 27200,
                },
                annualPaymentPence: 35150,
              },
            ],
          },
        ],
        totalAnnualPaymentPence: 35150,
      },
    },
  },
};

logger.info(
  { queueUrl, component: "cli.publish" },
  "Sending message to SQS queue",
);

await sqs.send(
  new SendMessageCommand({
    QueueUrl: queueUrl,
    MessageBody: JSON.stringify(
      process.argv[2] === "pmf" ? messagePmf : messageFrps,
    ),
    DelaySeconds: 0,
  }),
);

logger.info({ component: "cli.publish" }, "Message sent");
