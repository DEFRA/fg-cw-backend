// Integration test to verify realistic frps-private-beta payload
// can be processed through CW's case creation logic
//
// This test addresses the "danger area" - proving that the payload structure
// defined in the pact contract can actually be processed by createCaseUseCase,
// not just pass pact matchers.

import { describe, expect, it } from "vitest";
import { Case } from "../../src/cases/models/case.js";
import { Position } from "../../src/cases/models/position.js";

describe("Realistic Payload Processing", () => {
  describe("frps-private-beta realistic payload", () => {
    it("should be processable into a Case object", () => {
      // This is the exact realistic payload structure from the consumer pact test
      const realisticPayload = {
        createdAt: "2025-02-09T11:00:00.000Z",
        submittedAt: "2025-02-09T12:00:00.000Z",
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
          rulesCalculations: {
            id: 421,
            message: "Application validated successfully",
            valid: true,
            date: "2025-11-18T13:51:50.549Z",
          },
          applicant: {
            business: {
              name: "VAUGHAN FARMS LIMITED",
              reference: "3989509178",
              email: {
                address: "test@example.com",
              },
              phone: "01234031670",
              address: {
                line1: "Mason House Farm Clitheroe Rd",
                line2: "Bashall Eaves",
                street: "Bartindale Road",
                city: "Clitheroe",
                postalCode: "BB7 3DD",
              },
            },
            customer: {
              name: {
                title: "Mr.",
                first: "Edward",
                middle: "Paul",
                last: "Jones",
              },
            },
          },
          totalAnnualPaymentPence: 28062,
          application: {
            parcel: [
              {
                sheetId: "SD6843",
                parcelId: "9485",
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
                ],
              },
            ],
            agreement: [],
          },
          payments: {
            parcel: [
              {
                sheetId: "SD6843",
                parcelId: "9485",
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
                ],
              },
            ],
          },
        },
        metadata: {},
      };

      // Verify Case.new can accept this realistic payload without throwing
      // This is what createCaseUseCase does internally (src/cases/use-cases/create-case.use-case.js:53)
      expect(() => {
        const kase = Case.new({
          caseRef: "CASE-REF-001",
          workflowCode: "frps-private-beta",
          position: Position.from("PRE_AWARD:ASSESSMENT:IN_REVIEW"),
          payload: realisticPayload,
          phases: [],
        });

        // Verify the payload is stored correctly
        expect(kase.payload).toEqual(realisticPayload);
        expect(kase.payload.answers.rulesCalculations).toBeDefined();
        expect(kase.payload.answers.applicant).toBeDefined();
        expect(kase.payload.answers.application.parcel).toHaveLength(1);
        expect(kase.payload.answers.payments.parcel).toHaveLength(1);
      }).not.toThrow();
    });

    it("should handle minimal payload (without optional fields)", () => {
      const minimalPayload = {
        createdAt: "2025-02-09T11:00:00.000Z",
        submittedAt: "2025-02-09T12:00:00.000Z",
        identifiers: {
          sbi: "SBI002",
          frn: "FIRM0002",
          crn: "CUST0002",
        },
        answers: {
          scheme: "SFI",
          year: 2025,
          hasCheckedLandIsUpToDate: true,
        },
      };

      expect(() => {
        const kase = Case.new({
          caseRef: "CASE-REF-002",
          workflowCode: "frps-private-beta",
          position: Position.from("PRE_AWARD:ASSESSMENT:IN_REVIEW"),
          payload: minimalPayload,
          phases: [],
        });

        expect(kase.payload).toEqual(minimalPayload);
      }).not.toThrow();
    });
  });
});
