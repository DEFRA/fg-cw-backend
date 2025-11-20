import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { randomUUID } from "node:crypto";
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
            parcelId: "0118",
            sheetId: "AA0109",
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
        rulesCalculations: {
          id: 421,
          message: "Application validated successfully",
          valid: true,
          date: "2025-11-18T13:51:50.549Z",
        },
        scheme: "SFI",
        applicant: {
          business: {
            name: "Example Ridge Farm Ltd",
            reference: "9100000002",
            email: {
              address:
                "meadow@example.test",
            },
            phone: { mobile: "01632 960020" },
            address: {
              line1: "3 Example Lane",
              line2: "Example Village",
              line3: null,
              line4: null,
              line5: null,
              street: "Example Lane",
              city: "Exampleton",
              postalCode: "ZZ99 3ZZ",
            },
          },
          customer: {
            name: {
              title: "Mr.",
              first: "Jamie",
              middle: "Test",
              last: "Sample",
            },
          },
        },
        totalAnnualPaymentPence: 28062,
        application: {
          parcel: [
            {
              sheetId: "AA0007",
              parcelId: "0010",
              area: {
                unit: "ha",
                quantity: 0.1447,
              },
              actions: [
                {
                  code: "CMOR1",
                  version: 1,
                  durationYears: 3,
                  appliedFor: {
                    unit: "ha",
                    quantity: 0.1447,
                  },
                },
                {
                  code: "UPL1",
                  version: 1,
                  durationYears: 3,
                  appliedFor: {
                    unit: "ha",
                    quantity: 0.1447,
                  },
                },
              ],
            },
            {
              sheetId: "AA0007",
              parcelId: "0100",
              area: {
                unit: "ha",
                quantity: 0.3822,
              },
              actions: [
                {
                  code: "UPL2",
                  version: 1,
                  durationYears: 3,
                  appliedFor: {
                    unit: "ha",
                    quantity: 0.0792,
                  },
                },
              ],
            },
          ],
          agreement: [],
        },
        payments: {
          parcel: [
            {
              sheetId: "AA0007",
              parcelId: "0010",
              area: {
                unit: "ha",
                quantity: 0.1447,
              },
              actions: [
                {
                  code: "CMOR1",
                  description: "Assess moorland and produce a written record",
                  durationYears: 3,
                  paymentRates: 1060,
                  annualPaymentPence: 153,
                  eligible: {
                    unit: "ha",
                    quantity: 0.1447,
                  },
                  appliedFor: {
                    unit: "ha",
                    quantity: 0.1447,
                  },
                },
                {
                  code: "UPL1",
                  description: "Moderate livestock grazing on moorland",
                  durationYears: 3,
                  paymentRates: 2000,
                  annualPaymentPence: 289,
                  eligible: {
                    unit: "ha",
                    quantity: 0.1447,
                  },
                  appliedFor: {
                    unit: "ha",
                    quantity: 0.1447,
                  },
                },
              ],
            },
            {
              sheetId: "AA0007",
              parcelId: "0100",
              area: {
                unit: "ha",
                quantity: 0.3822,
              },
              actions: [
                {
                  code: "UPL2",
                  description: "Low livestock grazing on moorland",
                  durationYears: 3,
                  paymentRates: 5300,
                  annualPaymentPence: 419,
                  eligible: {
                    unit: "ha",
                    quantity: 0.0792,
                  },
                  appliedFor: {
                    unit: "ha",
                    quantity: 0.0792,
                  },
                },
              ],
            },
          ],
          agreement: [
            {
              code: "CMOR1",
              description: "Assess moorland and produce a written record",
              durationYears: 3,
              paymentRates: 27200,
              annualPaymentPence: 27200,
            },
          ],
        },
      },
    },
  },
};

console.log("Sending message to SQS queue:", queueUrl);

await sqs.send(
  new SendMessageCommand({
    QueueUrl: queueUrl,
    MessageBody: JSON.stringify(
      process.argv[2] === "pmf" ? messagePmf : messageFrps,
    ),
    DelaySeconds: 0,
  }),
);

console.log("Message sent");
