import { extractListQuery } from "../../common/helpers/api/request.js";
import { createWorkflowUseCase } from "../../use-case/workflow/create-workflow.use-case.js";
import { findWorkflowUseCase } from "../../use-case/workflow/find-workflow.use-case.js";
import { listWorkflowsUseCase } from "../../use-case/workflow/list-workflows.use-case.js";

export const workflowCreateController = async (request, h) => {
  await createWorkflowUseCase(request.payload);
  return h.response().code(201);
};

export const workflowDetailController = async ({ params: { code } }, h) => {
  return h.response(await findWorkflowUseCase(code));
};

export const workflowListController = async (request, h) => {
  return h.response(await listWorkflowsUseCase(extractListQuery(request)));
};
