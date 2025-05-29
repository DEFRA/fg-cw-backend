import Boom from "@hapi/boom";
import { extractListQuery } from "../../common/helpers/api/request.js";
import { createWorkflowUseCase } from "../../use-case/workflow/create-workflow.use-case.js";
import { workflowUseCase } from "../../use-case/workflow/workflow.use-case.js";

export const workflowCreateController = async (request, h) => {
  await createWorkflowUseCase(request.payload);
  return h.response().code(201);
};

export const workflowListController = async (request, h) => {
  const listQuery = extractListQuery(request);
  const results = await workflowUseCase.findWorkflows(listQuery);
  return h.response(results);
};

export const workflowDetailController = async (request, h) => {
  const result = await workflowUseCase.getWorkflow(request.params.code);
  if (!result) {
    return Boom.notFound(
      "Workflow with id: " + request.params.code + " not found"
    );
  }
  return h.response(result);
};
