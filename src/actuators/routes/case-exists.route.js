import { requireCaseReader } from "../../common/require-case-reader.js";
import {
  safeFailAction,
  safeResponseFailAction,
} from "../../common/validation.js";
import { caseKeyParams } from "../schemas/case-request.schema.js";
import { caseExistenceResponseSchema } from "../schemas/case-response.schema.js";
import { caseExistsUseCase } from "../use-cases/case-exists.use-case.js";

export const caseExistsRoute = {
  method: "GET",
  path: "/actuators/cases/{workflowCode}/{caseRef}/existence",
  options: {
    description: "Whether a case exists, and nothing else.",
    auth: "public-api",
    tags: ["api", "public-api"],
    plugins: {
      "hapi-swagger": { security: [{ serviceToken: [] }] },
    },
    ext: { onPostAuth: { method: requireCaseReader } },
    cache: { otherwise: "no-store" },
    validate: {
      params: caseKeyParams,
      failAction: safeFailAction,
    },
    response: {
      schema: caseExistenceResponseSchema,
      failAction: safeResponseFailAction,
    },
  },
  handler(request) {
    return caseExistsUseCase(request.params);
  },
};
