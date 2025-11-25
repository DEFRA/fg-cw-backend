import { logger } from "../../common/logger.js";
import { findCasesUseCase } from "../use-cases/find-cases.use-case.js";

export const findCasesRoute = {
  method: "GET",
  path: "/cases",
  options: {
    description: "Find all cases",
    tags: ["api"],
  },
  async handler() {
    logger.info("Finding cases");
    const results = await findCasesUseCase();
    logger.info("Finished finding cases");
    return results;
  },
};
