import { logger } from "../../common/logger.js";
import { findAll } from "../repositories/workflow.repository.js";

// eslint-disable-next-line complexity
export const findWorkflowsUseCase = async (query) => {
  logger.info(
    "Finding workflows use case started" +
      (query?.codes ? ` for code ${query.codes}` : ""),
  );
  const workflows = await findAll(query);

  logger.info(
    "Finished: Finding workflows use case started" +
      (query?.codes ? ` for code ${query.codes}` : ""),
  );
  return workflows;
};
