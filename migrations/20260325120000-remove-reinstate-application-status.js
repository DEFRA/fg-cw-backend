import { withTransaction } from "../src/common/with-transaction.js";

export const up = async (db) => {
  await withTransaction(async (session) => {
    await db.collection("workflows").updateMany(
      { code: "frps-private-beta" },
      {
        $pull: {
          "phases.0.stages.0.statuses.$[status].transitions": {
            "action.code": "REINSTATE_APPLICATION",
          },
          "phases.0.stages.1.statuses.$[status].transitions": {
            "action.code": "REINSTATE_APPLICATION",
          },
        },
      },
      {
        arrayFilters: [
          { "status.code": "APPLICATION_REJECTED" },
          { "status.code": "APPLICATION_REJECTED" },
        ],
        session,
      },
    );
  });
};
