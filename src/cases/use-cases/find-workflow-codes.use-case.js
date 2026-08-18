import { logger } from "../../common/logger.js";
import { findAllCodes } from "../repositories/workflow.repository.js";

export const findWorkflowCodesUseCase = async (query) => {
  logger.info("Finding workflow codes");

  logger.info(`Filtering by "${JSON.stringify(query)}"`);

  const codes = await findAllCodes(query);

  logger.info(`Finished: Finding workflow codes`);

  return codes;
};
