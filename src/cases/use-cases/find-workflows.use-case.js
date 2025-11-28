import { logger } from "../../common/logger.js";
import { findAll } from "../repositories/workflow.repository.js";

export const findWorkflowsUseCase = async (query) => {
  logger.info(`Finding workflows use case started for code ${query.code}`);

  const workflows = await findAll(query);

  logger.info(
    `Finished: Finding workflows use case started for code ${query.code}`,
  );
  return workflows;
};
