import Boom from "@hapi/boom";
import { extractListQuery } from "../common/helpers/api/request.js";
import { workflowService } from "../service/workflow.service.js";

export const workflowCreateController = async (request, h) => {
  const workflow = await workflowService.createWorkflow(
    request.payload,
    request.db
  );
  return h.response(workflow).code(201);
};

export const workflowListController = async (request, h) => {
  const listQuery = extractListQuery(request);
  const results = await workflowService.findWorkflows(listQuery, request.db);
  return h.response(results);
};

export const workflowDetailController = async (request, h) => {
  const result = await workflowService.getWorkflow(
    request.params.code,
    request.db
  );
  if (!result) {
    return Boom.notFound(
      "Workflow with id: " + request.params.code + " not found"
    );
  }
  return h.response(result);
};
