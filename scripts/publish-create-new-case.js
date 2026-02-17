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
  "http://sqs.eu-west-2.127.0.0.1:4566/000000000000/cw__sqs__create_new_case_fifo.fifo";

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
        isPigFarmer: true,
        totalPigs: 4,
        whitePigsCount: 2,
        britishLandracePigsCount: 2,
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
            email: "texelshirecontractingg@gnitcartnocerihslexeto.com.test",
            mobilePhoneNumber: "01234816251",
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
        totalAnnualPaymentPence: 2218816,
        application: {
          parcel: [
            {
              sheetId: "SK0971",
              parcelId: "LP1",
              area: { unit: "ha", quantity: 42.2832 },
              actions: [
                {
                  code: "CMOR1",
                  version: 1,
                  durationYears: 3,
                  appliedFor: { unit: "ha", quantity: 42.2832 },
                },
              ],
            },
            {
              sheetId: "SK0971",
              parcelId: "LP2",
              area: { unit: "ha", quantity: 681.6133 },
              actions: [
                {
                  code: "CMOR1",
                  version: 1,
                  durationYears: 3,
                  appliedFor: { unit: "ha", quantity: 681.6133 },
                },
                {
                  code: "UPL1",
                  version: 1,
                  durationYears: 3,
                  appliedFor: { unit: "ha", quantity: 681.6133 },
                },
              ],
            },
            {
              sheetId: "SK0971",
              parcelId: "LP3",
              area: { unit: "ha", quantity: 4.6832 },
              actions: [
                {
                  code: "CMOR1",
                  version: 1,
                  durationYears: 3,
                  appliedFor: { unit: "ha", quantity: 4.6832 },
                },
                {
                  code: "UPL2",
                  version: 1,
                  durationYears: 3,
                  appliedFor: { unit: "ha", quantity: 4.6832 },
                },
              ],
            },
            {
              sheetId: "SK0971",
              parcelId: "LP4",
              area: { unit: "ha", quantity: 2.0376 },
              actions: [
                {
                  code: "CMOR1",
                  version: 1,
                  durationYears: 3,
                  appliedFor: { unit: "ha", quantity: 2.0376 },
                },
                {
                  code: "UPL3",
                  version: 1,
                  durationYears: 3,
                  appliedFor: { unit: "ha", quantity: 2.0376 },
                },
              ],
            },
            {
              sheetId: "SK0971",
              parcelId: "LP5",
              area: { unit: "ha", quantity: 7.8332 },
              actions: [
                {
                  code: "UPL1",
                  version: 1,
                  durationYears: 3,
                  appliedFor: { unit: "ha", quantity: 7.8332 },
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
              parcelId: "LP1",
              area: { unit: "ha", quantity: 42.2832 },
              actions: [
                {
                  code: "CMOR1",
                  description: "Assess moorland and produce a written record",
                  durationYears: 3,
                  paymentRates: 1060,
                  annualPaymentPence: 44820,
                  eligible: { unit: "ha", quantity: 42.2832 },
                  appliedFor: { unit: "ha", quantity: 42.2832 },
                },
              ],
            },
            {
              sheetId: "SK0971",
              parcelId: "LP2",
              area: { unit: "ha", quantity: 681.6133 },
              actions: [
                {
                  code: "CMOR1",
                  description: "Assess moorland and produce a written record",
                  durationYears: 3,
                  paymentRates: 1060,
                  annualPaymentPence: 722510,
                  eligible: { unit: "ha", quantity: 681.6133 },
                  appliedFor: { unit: "ha", quantity: 681.6133 },
                },
                {
                  code: "UPL1",
                  description: "Moderate livestock grazing on moorland",
                  durationYears: 3,
                  paymentRates: 2000,
                  annualPaymentPence: 1363227,
                  eligible: { unit: "ha", quantity: 681.6133 },
                  appliedFor: { unit: "ha", quantity: 681.6133 },
                },
              ],
            },
            {
              sheetId: "SK0971",
              parcelId: "LP3",
              area: { unit: "ha", quantity: 4.6832 },
              actions: [
                {
                  code: "CMOR1",
                  description: "Assess moorland and produce a written record",
                  durationYears: 3,
                  paymentRates: 1060,
                  annualPaymentPence: 4964,
                  eligible: { unit: "ha", quantity: 4.6832 },
                  appliedFor: { unit: "ha", quantity: 4.6832 },
                },
                {
                  code: "UPL2",
                  description: "Limited livestock grazing on moorland",
                  durationYears: 3,
                  paymentRates: 5300,
                  annualPaymentPence: 24821,
                  eligible: { unit: "ha", quantity: 4.6832 },
                  appliedFor: { unit: "ha", quantity: 4.6832 },
                },
              ],
            },
            {
              sheetId: "SK0971",
              parcelId: "LP4",
              area: { unit: "ha", quantity: 2.0376 },
              actions: [
                {
                  code: "CMOR1",
                  description: "Assess moorland and produce a written record",
                  durationYears: 3,
                  paymentRates: 1060,
                  annualPaymentPence: 2160,
                  eligible: { unit: "ha", quantity: 2.0376 },
                  appliedFor: { unit: "ha", quantity: 2.0376 },
                },
                {
                  code: "UPL3",
                  description: "Limited livestock grazing on moorland",
                  durationYears: 3,
                  paymentRates: 6600,
                  annualPaymentPence: 13448,
                  eligible: { unit: "ha", quantity: 2.0376 },
                  appliedFor: { unit: "ha", quantity: 2.0376 },
                },
              ],
            },
            {
              sheetId: "SK0971",
              parcelId: "LP5",
              area: { unit: "ha", quantity: 7.8332 },
              actions: [
                {
                  code: "UPL1",
                  description: "Moderate livestock grazing on moorland",
                  durationYears: 3,
                  paymentRates: 2000,
                  annualPaymentPence: 15666,
                  eligible: { unit: "ha", quantity: 7.8332 },
                  appliedFor: { unit: "ha", quantity: 7.8332 },
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
      process.argv[2] === "pigs-might-fly" ? messagePmf : messageFrps,
    ),
    MessageGroupId: "cw-create-new-case",
    MessageDeduplicationId: randomUUID(),
    DelaySeconds: 0,
  }),
);

console.log("Message sent");
