export const up = async (db) => {
  const cases = db.collection("cases");

  await cases.updateMany(
    {},
    {
      $rename: {
        dateReceived: "createdAt",
      },
    },
  );
};
