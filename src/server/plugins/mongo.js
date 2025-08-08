import { mongoClient } from "../../common/mongo-client.js";

export const mongo = {
  name: "mongo",
  async register(server) {
    server.events.on("start", async () => {
      await mongoClient.connect();
    });

    server.events.on("stop", async () => {
      await mongoClient.close(true);
    });
  },
};
