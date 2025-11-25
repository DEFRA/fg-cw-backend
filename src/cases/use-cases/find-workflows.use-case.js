import { logger } from "../../common/logger.js";
import { findAll } from "../repositories/workflow.repository.js";

export const findWorkflowsUseCase = async (query) => {
  logger.debug(`Finding workflows use case started`);

  const workflows = await findAll(query);

  logger.debug(`Finished: Finding workflows use case started`);
  return workflows;
};
