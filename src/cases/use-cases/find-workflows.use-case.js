import { logger } from "../../common/logger.js";
import { findAll } from "../repositories/workflow.repository.js";

export const findWorkflowsUseCase = async (query) => {
  const message = `Finding workflows matching query ${JSON.stringify(query)}`;

  logger.info(message);

  const workflows = await findAll(query);

  logger.info(`Finished: ${message}`);

  return workflows;
};
