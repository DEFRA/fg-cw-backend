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
      configVersion: "1.0.0",
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
        whitePigsCount: 5,
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
        sbi: "900000005",
        frn: "9000000201",
        crn: "9000000101",
        defraId: "90000000201",
      },
      answers: {
        rulesCalculations: {
          id: 2979,
          message: "Application validated successfully",
          valid: true,
          date: "2025-11-28T15:32:42.983Z",
          caveats: [
            {
              code: "ne-consent-required",
              description: "SSSI consent required for land parcel",
              metadata: {
                sheetId: "AA0108",
                parcelId: "LP1",
                actionCode: "CMOR1",
                percentageOverlap: 45.5,
                overlapAreaHectares: 2.35,
              },
            },
          ],
        },
        scheme: "SFI",
        applicant: {
          business: {
            reference: "9000000202",
            email: "vale@example.test",
            mobilePhoneNumber: "02079460903",
            name: "Example Vale Contracting",
            address: {
              line1: "5 Example Lane",
              line2: "Example Village",
              line3: null,
              line4: null,
              line5: null,
              street: "Example Road",
              city: "Exampleton",
              postalCode: "ZZ99 5ZZ",
            },
          },
          customer: {
            name: {
              title: "Mr",
              first: "Taylor",
              middle: "Test",
              last: "Example",
            },
          },
        },
        totalAnnualPaymentPence: 2218816,
        application: {
          parcel: [
            {
              sheetId: "AA0108",
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
              sheetId: "AA0108",
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
              sheetId: "AA0108",
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
              sheetId: "AA0108",
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
              sheetId: "AA0108",
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
              sheetId: "AA0108",
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
              sheetId: "AA0108",
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
              sheetId: "AA0108",
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
              sheetId: "AA0108",
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
              sheetId: "AA0108",
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

const messageWMPCase = {
  id: randomUUID(),
  time: "2026-06-23T11:30:52.000Z",
  source: "fg-gas-backend",
  specversion: "1.0",
  type: "cloud.defra.local.fg-gas-backend.case.create",
  datacontenttype: "application/json",
  traceparent: randomUUID(),

  data: {
    id: randomUUID(),
    caseRef: `wmp-${Math.random().toString(36).substring(2, 5)}-${Math.random().toString(36).substring(2, 5)}`,
    workflowCode: "woodland",
    currentPhase: "PHASE_PRE_AWARD",
    currentStage: "STAGE_PREPARING_AGREEMENT",
    currentStatus: "STATUS_AGREEMENT_READY_FOR_APPLICANT",
    createdAt: "2026-06-08T17:02:59.660Z",

    payload: {
      configVersion: "1.0.1",
      createdAt: "2026-06-08T17:02:59.402Z",
      submittedAt: "2026-06-08T17:02:59.330Z",

      identifiers: {
        sbi: "900000007",
        frn: "9000000007",
        crn: "9000000007",
      },

      metadata: {},

      answers: {
        businessDetailsUpToDate: true,
        landRegisteredWithRpa: true,
        landManagementControl: false,
        counterSignature: true,
        publicBodyTenant: true,
        tenantObligations: false,
        landHasGrazingRights: true,
        appLandHasExistingWmp: true,
        existingWmps: "WMP-12345, WMP-23456",
        intendToApplyHigherTier: true,

        hectaresTenOrOverYearsOld: 0.4,
        hectaresUnderTenYearsOld: 0.1,

        centreGridReference: "AA 0000 0002",
        woodlandName: "Test Woodland",
        fcTeamCode: "EAST_AND_EAST_MIDLANDS",

        applicant: {
          business: {
            name: "Example Grove Farm",
            reference: "9000000007",

            email: {
              address: "grove@example.test",
            },

            phone: {
              mobile: "+44 7700 900003",
              landline: "020 7946 0904",
            },

            address: {
              line1: "6 Example Lane",
              line2: "Example Lane",
              line3: null,
              line4: null,
              line5: null,
              street: "Example Lane",
              city: "Exampleton",
              postalCode: "ZZ99 6ZZ",
              uprn: "990000000002",
              buildingName: "6 Example Lane",
              buildingNumberRange: null,
              county: "Example County",
              dependentLocality: null,
              doubleDependentLocality: null,
              flatName: null,
              pafOrganisationName: "Example Grove Farm",
            },

            vat: "GB123456789",

            type: {
              code: 101443,
              type: "Farmer",
            },
          },

          customer: {
            name: {
              title: "Mrs",
              first: "Morgan",
              middle: null,
              last: "Example",
            },

            email: {
              address: "grove@example.test",
            },

            phone: {
              mobile: "+44 7700 900003",
              landline: "020 7946 0904",
            },

            address: {
              line1: "7 Example Lane",
              line2: "Example Village",
              line3: null,
              line4: null,
              line5: null,
              street: "Example Village",
              city: "Exampleton",
              postalCode: "ZZ99 7ZZ",
              uprn: "990000000003",
              buildingName: "Example Cottage",
              buildingNumberRange: "2",
              county: "Example County",
              dependentLocality: null,
              doubleDependentLocality: null,
              flatName: null,
              pafOrganisationName: null,
            },
          },
        },

        detailsConfirmedAt: "2026-06-08T17:02:25.683Z",
        totalHectaresForSelectedParcels: 79.4865,

        guidanceRead: true,
        includedAllEligibleWoodland: true,
        applicationConfirmation: true,

        landParcels: [
          {
            parcelId: "AA0011-0101",
            areaHa: 68.0498,
          },
          {
            parcelId: "AA0005-0102",
            areaHa: 11.1006,
          },
          {
            parcelId: "AA0013-0103",
            areaHa: 0.3361,
          },
        ],

        totalAgreementPaymentPence: 150000,

        payments: {
          agreement: [
            {
              code: "PA3",
              description: "Woodland management plan",
              activePaymentTier: 1,
              quantityInActiveTier: 0.5,
              activeTierRatePence: 0,
              activeTierFlatRatePence: 150000,
              quantity: 0.5,
              agreementTotalPence: 150000,
              unit: "ha",
            },
          ],
        },
      },
    },

    supplementaryData: {},

    closed: false,
    closedAt: null,
    assignedUserId: null,
  },
};

const getMessage = (code) => {
  if (code === "pigs-might-fly") {
    return messagePmf;
  }
  if (code === "woodland") {
    return messageWMPCase;
  }
  return messageFrps;
};

const message = getMessage(process.argv[2]);
if (process.argv[3]) {
  message.data.payload.configVersion = process.argv[3];
}

console.log("Sending message to SQS queue:", queueUrl);

await sqs.send(
  new SendMessageCommand({
    QueueUrl: queueUrl,
    MessageBody: JSON.stringify(message),
    MessageGroupId: "cw-create-new-case",
    MessageDeduplicationId: randomUUID(),
    DelaySeconds: 0,
  }),
);

console.log("Message sent");
