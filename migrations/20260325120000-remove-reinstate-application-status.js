import { withTransaction } from "../src/common/with-transaction.js";

export const up = async (db) => {
  await withTransaction(async (session) => {
    await db.collection("workflows").updateMany(
      { code: "frps-private-beta" },
      {
        $pull: {
          "phases.0.stages.0.statuses.$[s1].transitions": {
            "action.code": "REINSTATE_APPLICATION",
          },
          "phases.0.stages.1.statuses.$[s2].transitions": {
            "action.code": "REINSTATE_APPLICATION",
          },
        },
      },
      {
        arrayFilters: [
          { "s1.code": "APPLICATION_REJECTED" },
          { "s2.code": "APPLICATION_REJECTED" },
        ],
        session,
      },
    );
  });
};
