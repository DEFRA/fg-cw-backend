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
          caveats: [
            {
              code: "ne-consent-required",
              description: "SSSI consent required for land parcel",
              metadata: {
                sheetId: "SK0971",
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
      createdAt: "2026-06-08T17:02:59.402Z",
      submittedAt: "2026-06-08T17:02:59.330Z",

      identifiers: {
        sbi: "113593357",
        frn: "1100943757",
        crn: "1100943757",
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

        centreGridReference: "SP 1234 5678",
        woodlandName: "Test Woodland",
        fcTeamCode: "EAST_AND_EAST_MIDLANDS",

        applicant: {
          business: {
            name: "Mellor & Sons",
            reference: "1100943757",

            email: {
              address: "patricia.mellor@mellorandsons.com.test",
            },

            phone: {
              mobile: "+44 7712 334891",
              landline: "01729 851204",
            },

            address: {
              line1: "Brackenfold Farm",
              line2: "Littondale Road",
              line3: null,
              line4: null,
              line5: null,
              street: "Littondale Road",
              city: "Skipton",
              postalCode: "BD23 5QH",
              uprn: "981124620011",
              buildingName: "Brackenfold Farm",
              buildingNumberRange: null,
              county: "North Yorkshire",
              dependentLocality: null,
              doubleDependentLocality: null,
              flatName: null,
              pafOrganisationName: "Mellor & Sons",
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
              first: "Patricia",
              middle: null,
              last: "Mellor",
            },

            email: {
              address: "patricia.mellor@mellorandsons.com.test",
            },

            phone: {
              mobile: "+44 7712 334891",
              landline: "01729 851204",
            },

            address: {
              line1: "2 Dales View Cottage",
              line2: "Arncliffe",
              line3: null,
              line4: null,
              line5: null,
              street: "Arncliffe",
              city: "Skipton",
              postalCode: "BD23 5QE",
              uprn: "981124620022",
              buildingName: "Dales View Cottage",
              buildingNumberRange: "2",
              county: "North Yorkshire",
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
            parcelId: "SD6351-8781",
            areaHa: 68.0498,
          },
          {
            parcelId: "SD6352-8774",
            areaHa: 11.1006,
          },
          {
            parcelId: "SD6252-7537",
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

console.log("Sending message to SQS queue:", queueUrl);

await sqs.send(
  new SendMessageCommand({
    QueueUrl: queueUrl,
    MessageBody: JSON.stringify(getMessage(process.argv[2])),
    MessageGroupId: "cw-create-new-case",
    MessageDeduplicationId: randomUUID(),
    DelaySeconds: 0,
  }),
);

console.log("Message sent");
