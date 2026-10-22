import { requireCaseReader } from "../../common/require-case-reader.js";
import {
  safeFailAction,
  safeResponseFailAction,
} from "../../common/validation.js";
import { workflowVersionParams } from "../schemas/workflow-version-request.schema.js";
import { workflowVersionExistenceResponseSchema } from "../schemas/workflow-version-response.schema.js";
import { workflowVersionExistsUseCase } from "../use-cases/workflow-version-exists.use-case.js";

export const workflowVersionExistsRoute = {
  method: "GET",
  path: "/actuators/workflows/{code}/versions/{version}/existence",
  options: {
    description: "Whether a workflow version exists, and nothing else.",
    auth: "public-api",
    tags: ["api", "public-api"],
    plugins: {
      "hapi-swagger": { security: [{ serviceToken: [] }] },
    },
    ext: { onPostAuth: { method: requireCaseReader } },
    cache: { otherwise: "no-store" },
    validate: {
      params: workflowVersionParams,
      failAction: safeFailAction,
    },
    response: {
      schema: workflowVersionExistenceResponseSchema,
      failAction: safeResponseFailAction,
    },
  },
  handler(request) {
    return workflowVersionExistsUseCase(request.params);
  },
};
