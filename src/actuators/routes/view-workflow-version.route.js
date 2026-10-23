import { requireCaseReader } from "../../common/require-case-reader.js";
import {
  safeFailAction,
  safeResponseFailAction,
} from "../../common/validation.js";
import { operatorHeaders } from "../schemas/operator-headers.schema.js";
import {
  workflowVersionParams,
  workflowVersionQuery,
} from "../schemas/workflow-version-request.schema.js";
import { workflowVersionResponseSchema } from "../schemas/workflow-version-response.schema.js";
import { viewWorkflowVersionUseCase } from "../use-cases/view-workflow-version.use-case.js";

export const viewWorkflowVersionRoute = {
  method: "GET",
  path: "/actuators/workflows/{code}/versions/{version}",
  options: {
    description:
      "One workflow version: its config version row, every version, the current one, and the stored workflow's size and summary, all null when it is not stored. With include=document, also the stored document and the address each endpoint resolves to here, in endpoint order. 404 with reason WORKFLOW_VERSION_NOT_FOUND when there is no such version.",
    auth: "public-api",
    tags: ["api", "public-api"],
    plugins: {
      "hapi-swagger": { security: [{ serviceToken: [] }] },
    },
    ext: { onPostAuth: { method: requireCaseReader } },
    cache: { otherwise: "no-store" },
    validate: {
      headers: operatorHeaders,
      params: workflowVersionParams,
      query: workflowVersionQuery,
      failAction: safeFailAction,
    },
    response: {
      schema: workflowVersionResponseSchema,
      failAction: safeResponseFailAction,
    },
  },
  handler(request) {
    const { code, version } = request.params;

    return viewWorkflowVersionUseCase({
      code,
      version,
      include: request.query.include,
    });
  },
};
