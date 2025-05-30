import { extractListQuery } from "../../common/helpers/api/request.js";
import { createWorkflowUseCase } from "../../use-case/workflow/create-workflow.use-case.js";
import { workflowUseCase } from "../../use-case/workflow/workflow.use-case.js";
import { findWorkflowUseCase } from "../../use-case/workflow/find-workflow.use-case.js";

export const workflowCreateController = async (request, h) => {
  await createWorkflowUseCase(request.payload);
  return h.response().code(201);
};

export const workflowDetailController = async ({ params: { code } }, h) => {
  const workflow = await findWorkflowUseCase(code);
  return h.response(workflow);
};

export const workflowListController = async (request, h) => {
  const listQuery = extractListQuery(request);
  const results = await workflowUseCase.findWorkflows(listQuery);
  return h.response(results);
};
