import Boom from "@hapi/boom";
import { logger } from "../../common/logger.js";
import { findByCode } from "../repositories/workflow.repository.js";

export const findWorkflowByCodeUseCase = async (code) => {
  logger.info(`Finding workflow by code "${code}"`);

  const workflow = await findByCode(code);

  if (!workflow) {
    throw Boom.notFound(`Workflow with code "${code}" not found`);
  }

  logger.info(`Finished: Finding workflow by code "${code}"`);

  return workflow;
};
