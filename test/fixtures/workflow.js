export const workflowData1 = {
  code: "frps-private-beta",
  payloadDefinition: {
    $id: "https://fg-cw.com/grant-application.schema.json",
    type: "object",
    properties: {
      clientRef: {
        type: "string"
      },
      code: {
        type: "string"
      },
      createdAt: {
        type: "object"
      },
      submittedAt: {
        type: "object"
      },
      identifiers: {
        type: "object",
        properties: {
          sbi: {
            type: "string"
          },
          frn: {
            type: "string"
          },
          crn: {
            type: "string"
          },
          defraId: {
            type: "string"
          }
        }
      },
      answers: {
        type: "object",
        properties: {
          scheme: {
            type: "string"
          },
          year: {
            type: "integer",
            minimum: 2000,
            maximum: 2100
          },
          hasCheckedLandIsUpToDate: {
            type: "boolean"
          },
          actionApplications: {
            type: "array",
            items: {
              type: "object",
              properties: {
                parcelId: {
                  type: "string"
                },
                sheetId: {
                  type: "string"
                },
                code: {
                  type: "string"
                },
                appliedFor: {
                  type: "object",
                  properties: {
                    unit: {
                      type: "string",
                      enum: ["ha", "acres", "sqm", "sqft"]
                    },
                    quantity: {
                      type: "number",
                      minimum: 0
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  },
  stages: [
    {
      id: "application-receipt",
      title: "Application Receipt",
      taskGroups: [
        {
          id: "application-receipt-tasks",
          title: "Application Receipt tasks",
          tasks: [
            {
              id: "simple-review",
              title: "Simple Review",
              type: "boolean"
            }
          ]
        }
      ],
      actions: [
        {
          id: "approve",
          label: "Approve"
        }
      ]
    },
    {
      id: "contract",
      title: "Stage for contract management",
      taskGroups: [],
      actions: []
    }
  ]
};

export const workflowData2 = {
  code: "GRANT-REF-2",
  payloadDefinition: {
    $id: "https://fg-cw.com/grant-application.schema.json",
    type: "object",
    properties: {
      clientRef: {
        type: "string"
      },
      code: {
        type: "string"
      },
      createdAt: {
        type: "object"
      },
      submittedAt: {
        type: "object"
      },
      identifiers: {
        type: "object",
        properties: {
          sbi: {
            type: "string"
          },
          frn: {
            type: "string"
          },
          crn: {
            type: "string"
          },
          defraId: {
            type: "string"
          }
        }
      },
      answers: {
        type: "object",
        properties: {
          scheme: {
            type: "string"
          },
          year: {
            type: "integer",
            minimum: 2000,
            maximum: 2100
          },
          hasCheckedLandIsUpToDate: {
            type: "boolean"
          },
          actionApplications: {
            type: "array",
            items: {
              type: "object",
              properties: {
                parcelId: {
                  type: "string"
                },
                sheetId: {
                  type: "string"
                },
                code: {
                  type: "string"
                },
                appliedFor: {
                  type: "object",
                  properties: {
                    unit: {
                      type: "string",
                      enum: ["ha", "acres", "sqm", "sqft"]
                    },
                    quantity: {
                      type: "number",
                      minimum: 0
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  },
  stages: [
    {
      id: "review",
      title: "Review",
      taskGroups: [],
      actions: []
    },
    {
      id: "decision",
      title: "Decision",
      taskGroups: [],
      actions: []
    }
  ]
};
