/**
 * @param db {import('mongodb').Db}
 * @returns {Promise<void>}
 */
export const up = async (db) => {
  const users = await db.collection("users").find().toArray();

  console.log(`Found ${users.length} users to migrate`);

  // Process each user
  for (const user of users) {
    if (Array.isArray(user.appRoles)) {
      const rolesObject = {};

      user.appRoles.forEach((role) => {
        if (typeof role === "string") {
          rolesObject[role] = {};
        }
      });

      await db
        .collection("users")
        .updateOne({ _id: user._id }, { $set: { appRoles: rolesObject } });

      console.log(
        `Migrated user ${user._id}: ${user.appRoles} -> ${JSON.stringify(rolesObject)}`,
      );
    }
  }

  console.log("Migration completed successfully");
};

/**
 * @param db {import('mongodb').Db}
 * @returns {Promise<void>}
 */
export const down = async (db) => {
  const users = await db.collection("users").find().toArray();

  console.log(`Found ${users.length} users to rollback`);

  for (const user of users) {
    if (
      user.appRoles &&
      typeof user.appRoles === "object" &&
      !Array.isArray(user.appRoles)
    ) {
      const rolesArray = Object.keys(user.appRoles);

      await db
        .collection("users")
        .updateOne({ _id: user._id }, { $set: { appRoles: rolesArray } });

      console.log(
        `Rolled back user ${user._id}: ${JSON.stringify(user.appRoles)} -> ${rolesArray}`,
      );
    }
  }

  console.log("Rollback completed successfully");
};
