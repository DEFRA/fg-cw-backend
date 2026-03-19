export const up = async (db) => {
  await db.collection("workflows").updateOne(
    { code: "frps-private-beta" },
    {
      $set: {
        requiredRoles: {
          allOf: ["ROLE_SFI_REFORM"],
          anyOf: [],
        },
      },
    },
  );
};
