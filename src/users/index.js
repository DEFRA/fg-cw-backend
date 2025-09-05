import { db } from "../common/mongo-client.js";
import { createRoleRoute } from "./routes/create-role.route.js";
import { createUserRoute } from "./routes/create-user.route.js";
import { findRoleByCodeRoute } from "./routes/find-role-by-code.route.js";
import { findRolesRoute } from "./routes/find-roles.route.js";
import { findSecretWorkflowRoute } from "./routes/find-secret-workflow.route.js";
// findSecretRoute removed - test endpoint no longer needed
import { findUserByIdRoute } from "./routes/find-user-by-id.route.js";
import { findUsersRoute } from "./routes/find-users.route.js";
import { updateUserRoute } from "./routes/update-user.route.js";

export const users = {
  name: "users",
  async register(server) {
    await Promise.all([
      db.createIndex("users", { idpId: 1 }, { unique: true }),
      db.createIndex("roles", { code: 1 }, { unique: true }),
    ]);

    server.route([
      createUserRoute,
      updateUserRoute,
      findUserByIdRoute,
      findUsersRoute,
      createRoleRoute,
      findRolesRoute,
      findRoleByCodeRoute,
      // findSecretRoute removed
      findSecretWorkflowRoute,
    ]);
  },
};
