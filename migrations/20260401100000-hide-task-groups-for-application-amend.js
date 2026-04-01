import { withTransaction } from "../src/common/with-transaction.js";

export const up = async (db) => {
  await withTransaction(async (session) => {
    const workflows = await db
      .collection("workflows")
      .find({ code: "frps-private-beta" })
      .toArray();

    for (const workflow of workflows) {
      for (const phase of workflow.phases) {
        for (const stage of phase.stages) {
          stage.statuses = stage.statuses.map((status) => {
            if (status.code !== "APPLICATION_AMEND") {
              return status;
            }

            return {
              ...status,
              hideTaskGroups: true,
            };
          });
        }
      }

      await db
        .collection("workflows")
        .updateOne(
          { _id: workflow._id },
          { $set: { phases: workflow.phases } },
          { session },
        );
    }
  });
};
