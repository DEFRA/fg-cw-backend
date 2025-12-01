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
      createdAt: "2025-11-28T15:32:43.054Z",
      submittedAt: "2025-11-28T15:32:42.983Z",
      identifiers: {
        sbi: "106284736",
        frn: "3314586376",
        crn: "1102838829",
        defraId: "12345678910",
      },
      answers: {
        rulesCalculations: {
          id: 2979,
          message: "Application validated successfully",
          valid: true,
          date: "2025-11-28T15:32:42.983Z",
        },
        scheme: "SFI",
        applicant: {
          business: {
            reference: "1101091126",
            email: {
              address: "texelshirecontractingg@gnitcartnocerihslexeto.com.test",
            },
            phone: { mobile: "01234816251" },
            name: "Texels Hire & Contracting",
            address: {
              line1: "Benbrigge House",
              line2: "ALBRIGHTON",
              line3: null,
              line4: null,
              line5: null,
              street: "BRIDGE ROAD",
              city: "GRIMSBY",
              postalCode: "DY13 0UY",
            },
          },
          customer: {
            name: {
              title: "Mr",
              first: "Graham",
              middle: "Lisa",
              last: "Gilfoyle",
            },
          },
        },
        totalAnnualPaymentPence: 70284,
        application: {
          parcel: [
            {
              sheetId: "SK0971",
              parcelId: "7555",
              area: { unit: "ha", quantity: 5.2182 },
              actions: [
                {
                  code: "CMOR1",
                  version: 1,
                  durationYears: 3,
                  appliedFor: { unit: "ha", quantity: 4.7575 },
                },
                {
                  code: "UPL3",
                  version: 1,
                  durationYears: 3,
                  appliedFor: { unit: "ha", quantity: 4.7575 },
                },
              ],
            },
            {
              sheetId: "SK0971",
              parcelId: "9194",
              area: { unit: "ha", quantity: 2.1703 },
              actions: [
                {
                  code: "CMOR1",
                  version: 1,
                  durationYears: 3,
                  appliedFor: { unit: "ha", quantity: 2.1705 },
                },
                {
                  code: "UPL1",
                  version: 1,
                  durationYears: 3,
                  appliedFor: { unit: "ha", quantity: 2.1705 },
                },
              ],
            },
          ],
          agreement: [],
        },
        payments: {
          parcel: [
            {
              sheetId: "SK0971",
              parcelId: "7555",
              area: { unit: "ha", quantity: 5.2182 },
              actions: [
                {
                  code: "CMOR1",
                  description: "Assess moorland and produce a written record",
                  durationYears: 3,
                  paymentRates: 1060,
                  annualPaymentPence: 5042,
                  eligible: { unit: "ha", quantity: 4.7575 },
                  appliedFor: { unit: "ha", quantity: 4.7575 },
                },
                {
                  code: "UPL3",
                  description: "Limited livestock grazing on moorland",
                  durationYears: 3,
                  paymentRates: 6600,
                  annualPaymentPence: 31399,
                  eligible: { unit: "ha", quantity: 4.7575 },
                  appliedFor: { unit: "ha", quantity: 4.7575 },
                },
              ],
            },
            {
              sheetId: "SK0971",
              parcelId: "9194",
              area: { unit: "ha", quantity: 2.1703 },
              actions: [
                {
                  code: "CMOR1",
                  description: "Assess moorland and produce a written record",
                  durationYears: 3,
                  paymentRates: 1060,
                  annualPaymentPence: 2300,
                  eligible: { unit: "ha", quantity: 2.1705 },
                  appliedFor: { unit: "ha", quantity: 2.1705 },
                },
                {
                  code: "UPL1",
                  description: "Moderate livestock grazing on moorland",
                  durationYears: 3,
                  paymentRates: 2000,
                  annualPaymentPence: 4341,
                  eligible: { unit: "ha", quantity: 2.1705 },
                  appliedFor: { unit: "ha", quantity: 2.1705 },
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
