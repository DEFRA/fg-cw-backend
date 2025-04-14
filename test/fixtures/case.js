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
              type: "radio",
              prompt: "Is the first part OK?",
              value: "YES"
            },
            {
              id: "2",
              type: "radio",
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
              type: "radio",
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
          status: "CANNOT START YET"
        }
      ]
    }
  ],
  payload: {
    grantApplication: {
      grantCode: "GRANT-REF-1",
      clientRef: "APPLICATION-REF-1",
      caseName: "Northampton Reservoir",
      businessName: "Farming Group Ltd",
      createdAt: "2025-03-27T10:34:52",
      submittedAt: "2025-03-27T11:30:52",
      data: [
        {
          id: "1",
          label: "SBI",
          data: "SBI001"
        },
        {
          id: "2",
          label: "Firm Reference Number",
          data: "FIRM0001"
        },
        {
          id: "3",
          label: "Customer Reference Number",
          data: "CUST0001"
        },
        {
          id: "4",
          label: "DEFRA ID",
          data: "DEFRA0001"
        },
        {
          id: "5",
          label: "DEFRA Scheme Name",
          data: "Defra Scheme One"
        },
        {
          id: "6",
          label: "Scheme Year",
          data: "2003"
        },
        {
          id: "7",
          label: "Land Data Up To Date",
          data: true
        }
      ]
    }
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
              type: "radio",
              prompt: "Is the first part OK?",
              value: "YES"
            },
            {
              id: "2",
              type: "radio",
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
              type: "radio",
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
          status: "CANNOT START YET"
        }
      ]
    }
  ],
  payload: {
    grantApplication: {
      grantCode: "GRANT-REF-1",
      clientRef: "APPLICATION-REF-1",
      caseName: "Northampton Reservoir",
      businessName: "Farming Group Ltd",
      createdAt: "2025-03-27T10:34:52",
      submittedAt: "2025-03-27T11:30:52",
      data: [
        {
          id: "1",
          label: "SBI",
          data: "SBI001"
        },
        {
          id: "2",
          label: "Firm Reference Number",
          data: "FIRM0001"
        },
        {
          id: "3",
          label: "Customer Reference Number",
          data: "CUST0001"
        },
        {
          id: "4",
          label: "DEFRA ID",
          data: "DEFRA0001"
        },
        {
          id: "5",
          label: "DEFRA Scheme Name",
          data: "Defra Scheme One"
        },
        {
          id: "6",
          label: "Scheme Year",
          data: "2003"
        },
        {
          id: "7",
          label: "Land Data Up To Date",
          data: true
        }
      ]
    }
  }
};
