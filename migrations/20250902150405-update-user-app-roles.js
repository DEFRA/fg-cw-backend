export const up = async (db) => {
  await db.collection("users").updateMany(
    {
      $expr: { $isArray: "$appRoles" },
    },
    [
      {
        $set: {
          appRoles: {
            $arrayToObject: {
              $map: {
                input: "$appRoles",
                as: "role",
                in: {
                  k: "$$role",
                  v: {},
                },
              },
            },
          },
        },
      },
    ],
  );
};

export const down = async (db) => {
  db.collection("users").updateMany({}, [
    {
      $set: {
        appRoles: {
          $map: {
            input: { $objectToArray: "$appRoles" },
            as: "item",
            in: "$$item.k",
          },
        },
      },
    },
  ]);
};
