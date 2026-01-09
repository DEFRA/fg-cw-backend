import { logger } from "../../common/logger.js";
import { findAll } from "../repositories/workflow.repository.js";

export const findWorkflowsUseCase = async (query) => {
  logger.info("Finding workflows");

  logger.info(`Filtering by "${JSON.stringify(query)}"`);

  const workflows = await findAll(query);

  logger.info(`Finished: Finding workflows`);

  return workflows;
};
