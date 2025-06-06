import { up } from "migrate-mongo";
import { logger } from "../common/logger.js";
import { db, mongoClient } from "../common/mongo-client.js";

import { createNewCaseSubscriber } from "./subscribers/create-new-case.subscriber.js";

import { casesRoutes } from "./routes/cases.js";
import { workflows } from "./routes/workflows.js";

export const cases = {
  name: "cases",
  async register(server, _options) {
    logger.info("Running DB Migrations");
    await up(db, mongoClient);
    logger.info("Finished running DB Migrations");

    server.events.on("start", async () => {
      await createNewCaseSubscriber.start();
    });

    server.events.on("stop", async () => {
      await createNewCaseSubscriber.stop();
    });

    server.route([...casesRoutes, ...workflows]);
  },
};
