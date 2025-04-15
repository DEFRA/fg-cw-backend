export const caseData1 = {
  id: "100001",
  workflowCode: "GRANT-REF-1",
  caseRef: "APPLICATION-REF-1",
  caseName: "Northampton Reservoir",
  businessName: "Farming Group Ltd",
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
    id: "100001",
    code: "GRANT-REF-1",
    clientRef: "APPLICATION-REF-1",
    caseName: "Northampton Reservoir",
    businessName: "Farming Group Ltd",
    createdAt: "2025-03-27T10:34:52.000Z",
    submittedAt: "2025-03-27T11:30:52.000Z",
    data: [
      {
        id: "1",
        label: "SBI",
        valueType: "string",
        valueString: "SBI001"
      },
      {
        id: "2",
        label: "Firm Reference Number",
        valueType: "string",
        valueString: "FIRM0001"
      },
      {
        id: "3",
        label: "Customer Reference Number",
        valueType: "string",
        valueString: "CUST0001"
      },
      {
        id: "4",
        label: "DEFRA ID",
        valueType: "string",
        valueString: "DEFRA0001"
      },
      {
        id: "5",
        label: "DEFRA Scheme Name",
        valueType: "string",
        valueString: "Defra Scheme One"
      },
      {
        id: "6",
        label: "Scheme Year",
        valueType: "string",
        valueString: "2003"
      },
      {
        id: "7",
        label: "Land Data Up To Date",
        valueType: "boolean",
        valueBoolean: true
      }
    ]
  }
};

export const caseData2 = {
  id: "100002",
  workflowCode: "GRANT-REF-1",
  caseRef: "APPLICATION-REF-2",
  caseName: "Northampton Reservoir",
  businessName: "Farming Group Ltd",
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
    id: "100002",
    code: "GRANT-REF-1",
    clientRef: "APPLICATION-REF-2",
    caseName: "Northampton Reservoir",
    businessName: "Farming Group Ltd",
    createdAt: "2025-03-27T10:34:52.000Z",
    submittedAt: "2025-03-27T11:30:52.000Z",
    data: [
      {
        id: "1",
        label: "SBI",
        valueType: "string",
        valueString: "SBI001"
      },
      {
        id: "2",
        label: "Firm Reference Number",
        valueType: "string",
        valueString: "FIRM0001"
      },
      {
        id: "3",
        label: "Customer Reference Number",
        valueType: "string",
        valueString: "CUST0001"
      },
      {
        id: "4",
        label: "DEFRA ID",
        valueType: "string",
        valueString: "DEFRA0001"
      },
      {
        id: "5",
        label: "DEFRA Scheme Name",
        valueType: "string",
        valueString: "Defra Scheme One"
      },
      {
        id: "6",
        label: "Scheme Year",
        valueType: "string",
        valueString: "2003"
      },
      {
        id: "7",
        label: "Land Data Up To Date",
        valueType: "boolean",
        valueBoolean: true
      }
    ]
  }
};

export const caseData3 = {
  id: "100003",
  workflowCode: "GRANT-REF-1",
  caseRef: "APPLICATION-REF-3",
  caseName: "Northampton Reservoir",
  businessName: "Farming Group Ltd",
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
    id: "100003",
    code: "GRANT-REF-1",
    clientRef: "APPLICATION-REF-3",
    caseName: "Northampton Reservoir",
    businessName: "Farming Group Ltd",
    createdAt: "2025-03-27T10:34:52.000Z",
    submittedAt: "2025-03-27T11:30:52.000Z",
    data: [
      {
        id: "1",
        label: "SBI",
        valueType: "string",
        valueString: "SBI001"
      },
      {
        id: "2",
        label: "Firm Reference Number",
        valueType: "string",
        valueString: "FIRM0001"
      },
      {
        id: "3",
        label: "Customer Reference Number",
        valueType: "string",
        valueString: "CUST0001"
      },
      {
        id: "4",
        label: "DEFRA ID",
        valueType: "string",
        valueString: "DEFRA0001"
      },
      {
        id: "5",
        label: "DEFRA Scheme Name",
        valueType: "string",
        valueString: "Defra Scheme One"
      },
      {
        id: "6",
        label: "Scheme Year",
        valueType: "string",
        valueString: "2003"
      },
      {
        id: "7",
        label: "Land Data Up To Date",
        valueType: "boolean",
        valueBoolean: true
      }
    ]
  }
};
