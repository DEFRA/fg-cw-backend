export const up = async (db) => {
  await db.collection("workflows").updateOne(
    { code: "pigs-might-fly" },
    {
      $set: {
        // Update tasks - no note required
        "stages.1.taskGroups.0.tasks": [
          {
            id: "check-application-and-documents",
            title: "Check application and documents",
            type: "boolean",
          },
          {
            id: "check-find-farm-and-land-payment-data",
            title: "Check on Find farm and land payment data",
            type: "boolean",
          },
          {
            id: "check-rps-dual-funding",
            title: "Check on RPS (Dual Funding)",
            type: "boolean",
          },
        ],
        "stages.1.taskGroups.1.tasks": [
          {
            id: "confirm-farm-has-cph",
            title: "Confirm farm has a CPH",
            type: "boolean",
          },
          {
            id: "confirm-apha-registration",
            title: "Confirm APHA registration",
            type: "boolean",
          },
        ],
        "stages.1.taskGroups.2": {
          id: "review-available-area-checks",
          title: "Review available area checks",
          tasks: [
            {
              id: "so3757-3159",
              title: "SFI available area check",
              type: "boolean",
              comment: {
                label: "Note",
                helpText: "All notes are saved for auditing purposes",
                type: "REQUIRED",
              },
            },
            {
              id: "so3757-3164",
              title: "SFI available area check",
              type: "boolean",
              comment: {
                label: "Note",
                helpText: "All notes are saved for auditing purposes",
                type: "REQUIRED",
              },
            },
            {
              id: "so3757-confirm-area-check",
              title: "Confirm available area check",
              type: "boolean",
              comment: {
                label: "Note",
                helpText: "All notes are saved for auditing purposes",
                type: "OPTIONAL",
              },
            },
          ],
        },
        "stages.1.taskGroups.3": {
          id: "review-intersecting-data-layers",
          title: "Review intersecting data layers",
          tasks: [
            {
              id: "so3756-3059",
              title: "SFI intersecting layers check",
              type: "boolean",
              comment: {
                label: "Note",
                helpText: "All notes are saved for auditing purposes",
                type: "REQUIRED",
              },
            },
            {
              id: "so3756-3064",
              title: "SFI intersecting layers check",
              type: "boolean",
              comment: {
                label: "Note",
                helpText: "All notes are saved for auditing purposes",
                type: "REQUIRED",
              },
            },
            {
              id: "so3757-confirm-area-check",
              title: "Confirm available area check",
              type: "boolean",
              comment: {
                label: "Note",
                helpText: "All notes are saved for auditing purposes",
                type: "OPTIONAL",
              },
            },
          ],
        },
      },
    },
  );
};

export const down = async (db) => {
  await db.collection("workflows").updateOne(
    { code: "pigs-might-fly" },
    {
      $set: {
        // Revert task note
        "stages.1.taskGroups.0.tasks": [
          {
            id: "check-application-and-documents",
            title: "Check application and documents",
            type: "boolean",
          },
          {
            id: "check-find-farm-and-land-payment-data",
            title: "Check on Find farm and land payment data",
            type: "boolean",
          },
          {
            id: "check-rps-dual-funding",
            title: "Check on RPS (Dual Funding)",
            type: "boolean",
          },
        ],
        "stages.1.taskGroups.1.tasks": [
          {
            id: "confirm-farm-has-cph",
            title: "Confirm farm has a CPH",
            type: "boolean",
          },
          {
            id: "confirm-apha-registration",
            title: "Confirm APHA registration",
            type: "boolean",
          },
        ],
        "stages.1.taskGroups.2": null,
        "stages.1.taskGroups.3": null,
      },
    },
  );
};
