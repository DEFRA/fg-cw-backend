export const caseData1 = {
  workflowCode: "GRANT-REF-1",
  caseRef: "APPLICATION-REF-1",
  status: "NEW",
  dateReceived: "2025-03-27T11:34:52.000Z",
  targetDate: "2025-04-27T11:34:52.000Z",
  priority: "MEDIUM",
  assignedUser: "Mark Ford",
  taskSections: [
    {
      id: "1",
      title: "Check application",
      taskGroups: [
        {
          id: "1",
          title: "Check application and documents",
          tasks: [
            {
              id: "1",
              inputType: "radio",
              prompt: "Is the first part OK?",
              value: "YES"
            },
            {
              id: "2",
              inputType: "radio",
              prompt: "Is the second part OK?",
              value: "YES"
            }
          ],
          status: "COMPLETED"
        },
        {
          id: "2",
          title: "Check for dual funding",
          tasks: [
            {
              id: "1",
              inputType: "radio",
              prompt: "Is the dual funding available?",
              value: null
            }
          ],
          status: "NOT STARTED"
        }
      ]
    },
    {
      id: "2",
      title: "Make Application Decision",
      taskGroups: [
        {
          id: "1",
          dependsOnActionCompletion: ["1", "2"],
          title: "Approve or reject application",
          tasks: [
            {
              id: "1",
              inputType: "select",
              options: [
                {
                  label: "Approve",
                  value: "APPROVE"
                },
                {
                  label: "Reject",
                  value: "REJECT"
                }
              ],
              prompt: "Approve or Reject?",
              value: null
            }
          ],
          status: "NOT STARTED"
        }
      ]
    }
  ],
  payload: {
    clientRef: "APPLICATION-REF-1",
    code: "GRANT-REF-1",
    createdAt: "2025-03-27T10:34:52.000Z",
    submittedAt: "2025-03-28T11:30:52.000Z",
    identifiers: {
      sbi: "SBI001",
      frn: "FIRM0001",
      crn: "CUST0001",
      defraId: "DEFRA0001"
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
            quantity: 20.23
          }
        }
      ]
    }
  }
};

export const caseData2 = {
  workflowCode: "GRANT-REF-1",
  caseRef: "APPLICATION-REF-2",
  status: "NEW",
  dateReceived: "2025-03-27T11:34:52Z",
  targetDate: "2025-04-27T11:34:52Z",
  priority: "MEDIUM",
  assignedUser: "Mark Ford",
  taskSections: [
    {
      id: "1",
      title: "Check application",
      taskGroups: [
        {
          id: "1",
          title: "Check application and documents",
          tasks: [
            {
              id: "1",
              inputType: "radio",
              prompt: "Is the first part OK?",
              value: "YES"
            },
            {
              id: "2",
              inputType: "radio",
              prompt: "Is the second part OK?",
              value: "YES"
            }
          ],
          status: "COMPLETED"
        },
        {
          id: "2",
          title: "Check for dual funding",
          tasks: [
            {
              id: "1",
              inputType: "radio",
              prompt: "Is the dual funding available?",
              value: null
            }
          ],
          status: "NOT STARTED"
        }
      ]
    },
    {
      id: "2",
      title: "Make Application Decision",
      taskGroups: [
        {
          id: "1",
          dependsOnActionCompletion: ["1", "2"],
          title: "Approve or reject application",
          tasks: [
            {
              id: "1",
              inputType: "select",
              options: [
                {
                  label: "Approve",
                  value: "APPROVE"
                },
                {
                  label: "Reject",
                  value: "REJECT"
                }
              ],
              prompt: "Approve or Reject?",
              value: null
            }
          ],
          status: "NOT STARTED"
        }
      ]
    }
  ],
  payload: {
    clientRef: "APPLICATION-REF-2",
    code: "GRANT-REF-1",
    createdAt: "2025-03-27T10:34:52.000Z",
    submittedAt: "2025-03-28T11:30:52.000Z",
    identifiers: {
      sbi: "SBI001",
      frn: "FIRM0001",
      crn: "CUST0001",
      defraId: "DEFRA0001"
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
            quantity: 20.23
          }
        }
      ]
    }
  }
};

export const caseData3 = {
  workflowCode: "GRANT-REF-1",
  caseRef: "APPLICATION-REF-3",
  status: "NEW",
  dateReceived: "2025-03-27T11:34:52.000Z",
  targetDate: null,
  priority: "LOW",
  assignedUser: null,
  taskSections: [
    {
      id: "1",
      title: "Check application",
      taskGroups: [
        {
          id: "1",
          title: "Check application and documents",
          tasks: [
            {
              id: "1",
              inputType: "radio",
              prompt: "Is the first part OK?",
              value: null
            },
            {
              id: "2",
              inputType: "radio",
              prompt: "Is the second part OK?",
              value: null
            }
          ],
          status: "NOT STARTED"
        },
        {
          id: "2",
          title: "Check for dual funding",
          tasks: [
            {
              id: "1",
              inputType: "radio",
              prompt: "Is the dual funding available?",
              value: null
            }
          ],
          status: "NOT STARTED"
        }
      ]
    },
    {
      id: "2",
      title: "Make Application Decision",
      taskGroups: [
        {
          id: "1",
          dependsOnActionCompletion: ["1", "2"],
          title: "Approve or reject application",
          tasks: [
            {
              id: "1",
              inputType: "select",
              options: [
                {
                  label: "Approve",
                  value: "APPROVE"
                },
                {
                  label: "Reject",
                  value: "REJECT"
                }
              ],
              prompt: "Approve or Reject?",
              value: null
            }
          ],
          status: "NOT STARTED"
        }
      ]
    }
  ],
  payload: {
    clientRef: "APPLICATION-REF-3",
    code: "GRANT-REF-1",
    createdAt: "2025-03-27T10:34:52.000Z",
    submittedAt: "2025-03-28T11:30:52.000Z",
    identifiers: {
      sbi: "SBI001",
      frn: "FIRM0001",
      crn: "CUST0001",
      defraId: "DEFRA0001"
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
            quantity: 20.23
          }
        }
      ]
    }
  }
};
