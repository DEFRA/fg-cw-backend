export const up = async (db) => {
  await db.collection("cases").updateMany(
    {},
    {
      $rename: { status: "currentStatus" },
    },
  );
};

export const down = async (db) => {
  await db.collection("cases").updateMany(
    {},
    {
      $rename: { currentStatus: "status" },
    },
  );
};
