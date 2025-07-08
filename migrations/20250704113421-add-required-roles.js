export const up = async (db) => {
  await db
    .collection("workflows")
    .updateMany({}, { $set: { requiredRoles: { allOf: [], anyOf: [] } } });
};

export const down = async (db) => {
  await db
    .collection("workflows")
    .updateMany({}, { $unset: { requiredRoles: "" } });
};
