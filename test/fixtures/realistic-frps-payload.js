// Realistic frps-private-beta payload structure
// Used by consumer pact tests and integration tests to ensure consistency
// This is the actual payload structure GAS sends to CW in production

export const realisticFrpsPayload = {
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
        name: "Example Ridge Farm Ltd",
        reference: "9100000002",
        email: {
          address: "contact@example.test",
        },
        phone: "02079460901",
        address: {
          line1: "3 Example Lane",
          line2: "Example Village",
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
          ],
        },
      ],
    },
  },
  metadata: {},
};

export const minimalFrpsPayload = {
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
