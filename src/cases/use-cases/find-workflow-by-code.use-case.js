import Boom from "@hapi/boom";
import { logger } from "../../common/logger.js";
import { findByCode } from "../repositories/workflow.repository.js";

export const findWorkflowByCodeUseCase = async (code) => {
  logger.debug({ code }, "Finding workflow by code use case");

  const workflow = await findByCode(code);

  if (!workflow) {
    throw Boom.notFound(`Workflow with code "${code}" not found`);
  }

  logger.debug(
    { code, workflowId: workflow._id },
    "Workflow found successfully",
  );

  return workflow;
};
