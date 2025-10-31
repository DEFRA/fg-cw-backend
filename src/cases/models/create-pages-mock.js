export const createPagesMock = () => ({
  cases: {
    details: {
      banner: {
        title: {
          text: "$.payload.businessName",
          type: "string",
        },
        summary: {
          clientReference: {
            text: "$.caseRef",
            label: "Client Reference",
            type: "string",
          },
        },
      },
      tabs: {
        "case-details": {
          content: [
            {
              title: "Details",
              type: "object",
              component: "list",
              rows: [
                {
                  text: "$.payload.answers.field1",
                  type: "string",
                  label: "Field 1",
                },
              ],
            },
          ],
        },
      },
    },
  },
});
