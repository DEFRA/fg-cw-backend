import { requireCaseReader } from "../../common/require-case-reader.js";
import {
  safeFailAction,
  safeResponseFailAction,
} from "../../common/validation.js";
import { operatorHeaders } from "../schemas/operator-headers.schema.js";
import { workflowCodeParams } from "../schemas/workflow-version-request.schema.js";
import { workflowVersionsResponseSchema } from "../schemas/workflow-version-response.schema.js";
import { viewWorkflowVersionsUseCase } from "../use-cases/view-workflow-versions.use-case.js";

export const viewWorkflowVersionsRoute = {
  method: "GET",
  path: "/actuators/workflows/{code}/versions",
  options: {
    description:
      "Every config version of a workflow, newest first, and the current one: the newest active version, or null. 404 with reason WORKFLOW_NOT_FOUND when the code has none.",
    auth: "public-api",
    tags: ["api", "public-api"],
    plugins: {
      "hapi-swagger": { security: [{ serviceToken: [] }] },
    },
    ext: { onPostAuth: { method: requireCaseReader } },
    cache: { otherwise: "no-store" },
    validate: {
      headers: operatorHeaders,
      params: workflowCodeParams,
      failAction: safeFailAction,
    },
    response: {
      schema: workflowVersionsResponseSchema,
      failAction: safeResponseFailAction,
    },
  },
  handler(request) {
    return viewWorkflowVersionsUseCase({ code: request.params.code });
  },
};
