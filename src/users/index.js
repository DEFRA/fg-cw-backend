import { db } from "../common/mongo-client.js";
import { createUserRoute } from "./routes/create-user.route.js";
import { findUserByIdRoute } from "./routes/find-user-by-id.route.js";
import { findUsersRoute } from "./routes/find-users.route.js";
import { updateUserRoute } from "./routes/update-user.route.js";

export const users = {
  name: "users",
  async register(server) {
    await db.createIndex("users", { idpId: 1 }, { unique: true });

    server.route([
      createUserRoute,
      updateUserRoute,
      findUserByIdRoute,
      findUsersRoute,
    ]);
  },
};
