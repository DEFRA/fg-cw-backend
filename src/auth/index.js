import { authRoute } from "./routes/auth.route.js";

export const auth = {
  name: "auth",
  async register(server) {
    server.route([
      authRoute
    ]);
  },
};
