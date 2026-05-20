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
