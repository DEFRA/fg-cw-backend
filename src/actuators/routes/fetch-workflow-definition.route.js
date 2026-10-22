import { requireCaseReader } from "../../common/require-case-reader.js";
import {
  safeFailAction,
  safeResponseFailAction,
} from "../../common/validation.js";
import { requiredActorQuery } from "../schemas/box-query.schema.js";
import { workflowVersionParams } from "../schemas/workflow-version-request.schema.js";
import { workflowDefinitionFetchResponseSchema } from "../schemas/workflow-version-response.schema.js";
import { fetchWorkflowDefinitionUseCase } from "../use-cases/fetch-workflow-definition.use-case.js";

export const fetchWorkflowDefinitionRoute = {
  method: "POST",
  path: "/actuators/workflows/{code}/versions/{version}/fetch",
  options: {
    description:
      "Fetch a workflow version's definition from S3 and store it, only if it is not stored and only if it is a valid workflow for this code. The config version record is never changed. Names the operator in `by`, which the fetch is audited under and so is required. 200 with each file's outcome, or no files when it was already stored; 404 with reason WORKFLOW_VERSION_NOT_FOUND when there is no such version.",
    auth: "public-api",
    tags: ["api", "public-api"],
    plugins: {
      "hapi-swagger": { security: [{ serviceToken: [] }] },
    },
    ext: { onPostAuth: { method: requireCaseReader } },
    validate: {
      params: workflowVersionParams,
      query: requiredActorQuery,
      failAction: safeFailAction,
    },
    response: {
      schema: workflowDefinitionFetchResponseSchema,
      failAction: safeResponseFailAction,
    },
  },
  handler(request) {
    const { code, version } = request.params;

    return fetchWorkflowDefinitionUseCase({
      grantCode: code,
      version,
      by: request.query.by,
      caller: request.auth.credentials.service,
    });
  },
};
