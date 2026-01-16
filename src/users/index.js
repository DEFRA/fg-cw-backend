import { adminFindUsersRoute } from "./routes/admin-find-users.route.js";
import { createRoleRoute } from "./routes/create-role.route.js";
import { createUserRoute } from "./routes/create-user.route.js";
import { findAssigneesRoute } from "./routes/find-assignees.route.js";
import { findRoleByCodeRoute } from "./routes/find-role-by-code.route.js";
import { findRolesRoute } from "./routes/find-roles.route.js";
import { findUserByIdRoute } from "./routes/find-user-by-id.route.js";
import { findUsersRoute } from "./routes/find-users.route.js";

import { updateUserRoute } from "./routes/update-user.route.js";

export const users = {
  name: "users",
  async register(server) {
    server.route([
      createUserRoute,
      updateUserRoute,
      findUserByIdRoute,
      findUsersRoute,
      adminFindUsersRoute,
      findAssigneesRoute,
      createRoleRoute,
      findRolesRoute,
      findRoleByCodeRoute,
    ]);
  },
};
