import Boom from "@hapi/boom";
import { logger } from "../../common/logger.js";
import { findByCode } from "../repositories/workflow.repository.js";

export const findWorkflowByCodeUseCase = async (code) => {
  logger.debug(`Finding workflow by code use case started - code: ${code}`);

  const workflow = await findByCode(code);

  if (!workflow) {
    throw Boom.notFound(`Workflow with code "${code}" not found`);
  }

  logger.debug(
    `Workflow found successfully - code: ${code} and workflowId: ${workflow._id}`,
  );

  return workflow;
};
