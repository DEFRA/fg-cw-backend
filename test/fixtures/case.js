export const caseData1 = {
  workflowCode: "frps-private-beta",
  caseRef: "APPLICATION-REF-1",
  status: "NEW",
  dateReceived: "2025-03-27T11:34:52.000Z",
  payload: {
    clientRef: "APPLICATION-REF-1",
    code: "frps-private-beta",
    createdAt: "2025-03-27T10:34:52.000Z",
    submittedAt: "2025-03-28T11:30:52.000Z",
    identifiers: {
      sbi: "SBI001",
      frn: "FIRM0001",
      crn: "CUST0001",
      defraId: "DEFRA0001",
    },
    answers: {
      agreementName: "Test application name",
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
  currentStage: "application-receipt",
  stages: [
    {
      id: "application-receipt",
      taskGroups: [
        {
          id: "application-receipt-tasks",
          tasks: [
            {
              id: "simple-review",
              status: "pending",
            },
          ],
        },
      ],
    },
    {
      id: "contract",
      taskGroups: [],
    },
  ],
};

export const caseData2 = {
  workflowCode: "frps-private-beta",
  caseRef: "APPLICATION-REF-2",
  status: "NEW",
  dateReceived: "2025-03-27T11:34:52Z",
  payload: {
    clientRef: "APPLICATION-REF-2",
    code: "frps-private-beta",
    createdAt: "2025-03-27T10:34:52.000Z",
    submittedAt: "2025-03-28T11:30:52.000Z",
    identifiers: {
      sbi: "SBI001",
      frn: "FIRM0001",
      crn: "CUST0001",
      defraId: "DEFRA0001",
    },
    answers: {
      agreementName: "Test application name",
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
  currentStage: "application-receipt",
  stages: [
    {
      id: "application-receipt",
      taskGroups: [
        {
          id: "application-receipt-tasks",
          tasks: [
            {
              id: "simple-review",
              status: "pending",
            },
          ],
        },
      ],
    },
    {
      id: "contract",
      taskGroups: [],
    },
  ],
};

export const caseData3 = {
  workflowCode: "frps-private-beta",
  caseRef: "APPLICATION-REF-3",
  status: "NEW",
  dateReceived: "2025-03-27T11:34:52.000Z",
  payload: {
    clientRef: "APPLICATION-REF-3",
    code: "frps-private-beta",
    createdAt: "2025-03-27T10:34:52.000Z",
    submittedAt: "2025-03-28T11:30:52.000Z",
    identifiers: {
      sbi: "SBI001",
      frn: "FIRM0001",
      crn: "CUST0001",
      defraId: "DEFRA0001",
    },
    answers: {
      agreementName: "Test application name",
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
  currentStage: "application-receipt",
  stages: [
    {
      id: "application-receipt",
      taskGroups: [
        {
          id: "application-receipt-tasks",
          tasks: [
            {
              id: "simple-review",
              status: "pending",
            },
          ],
        },
      ],
    },
    {
      id: "contract",
      taskGroups: [],
    },
  ],
};
