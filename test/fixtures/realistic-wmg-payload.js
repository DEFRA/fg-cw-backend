// Realistic woodland management grant (WMG) payload structure
// Used by consumer pact tests to ensure consistency
// This is the actual payload structure GAS sends to CW in production for WMG applications
// Field names are authoritative from woodland.json schema (fg-gas-backend)

export const realisticWmgPayload = {
  createdAt: "2025-02-09T11:00:00.000Z",
  submittedAt: "2025-02-09T12:00:00.000Z",
  identifiers: {
    sbi: "SBI001",
    frn: "FIRM0001",
    crn: "CUST0001",
    defraId: "DEFRA0001",
  },
  answers: {
    businessDetailsUpToDate: true,
    guidanceRead: true,
    landRegisteredWithRpa: true,
    landManagementControl: true,
    publicBodyTenant: false,
    landHasGrazingRights: false,
    appLandHasExistingWmp: true,
    existingWmps: ["WMP-2024-001"],
    intendToApplyHigherTier: false,
    includedAllEligibleWoodland: true,
    totalHectaresAppliedFor: 15.0,
    hectaresTenOrOverYearsOld: 8.5,
    hectaresUnderTenYearsOld: 4.2,
    centreGridReference: "SK512347",
    fcTeamCode: "YORKSHIRE_AND_NORTH_EAST",
    applicationConfirmation: true,
  },
  metadata: {},
};

export const minimalWmgPayload = {
  createdAt: "2025-02-09T11:00:00.000Z",
  submittedAt: "2025-02-09T12:00:00.000Z",
  identifiers: {
    sbi: "SBI003",
    frn: "FIRM0003",
    crn: "CUST0003",
  },
  answers: {
    businessDetailsUpToDate: true,
    guidanceRead: true,
    landRegisteredWithRpa: true,
    landManagementControl: true,
    publicBodyTenant: false,
    landHasGrazingRights: false,
    appLandHasExistingWmp: false,
    intendToApplyHigherTier: false,
    includedAllEligibleWoodland: true,
    totalHectaresAppliedFor: 10.0,
    hectaresTenOrOverYearsOld: 6.0,
    hectaresUnderTenYearsOld: 4.0,
    centreGridReference: "SK512347",
    fcTeamCode: "SOUTH_WEST",
    applicationConfirmation: true,
  },
};
