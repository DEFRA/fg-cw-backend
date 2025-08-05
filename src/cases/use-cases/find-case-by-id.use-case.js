import Boom from "@hapi/boom";
import { findById } from "../repositories/case.repository.js";
import { enrichCaseUseCase } from "./enrich-case.use-case.js";
import { findWorkflowByCodeUseCase } from "./find-workflow-by-code.use-case.js";

export const findCaseByIdUseCase = async (caseId) => {
  const kase = await findById(caseId);

  if (!kase) {
    throw Boom.notFound(`Case with id "${caseId}" not found`);
  }

  const workflow = await findWorkflowByCodeUseCase(kase.workflowCode);

  if (!workflow) {
    throw Boom.notFound(`Workflow with code "${kase.workflowCode}" not found`);
  }

  return await enrichCaseUseCase(kase, workflow);
};

export const findUserAssignedToCase = () => {
  return "System"; // TODO: get user who has completed the task from auth
};
