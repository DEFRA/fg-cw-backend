import { withTransaction } from "../src/common/with-transaction.js";

export const up = async (db) => {
  const closes = [
    "APPLICATION_WITHDRAWN",
    "APPLICATION_REJECTED",
    "APPLICATION_AMEND",
    "AGREEMENT_TERMINATED",
  ];

  await withTransaction(async (session) => {
    await db.collection("cases").updateMany(
      {},
      [
        {
          $set: {
            closed: {
              $ifNull: ["$closed", false],
            },
            closedAt: null,
          },
        },
      ],
      { session },
    );

    const workflows = await db.collection("workflows").find({}).toArray();
    for (const workflow of workflows) {
      for (const phase of workflow.phases) {
        for (const stage of phase.stages) {
          stage.statuses = stage.statuses.map((status) => {
            return {
              ...status,
              closes: closes.includes(status.code),
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
