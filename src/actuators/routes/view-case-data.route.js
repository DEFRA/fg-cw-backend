import { operatorOf } from "../../common/actor-header.js";
import { requireCaseReader } from "../../common/require-case-reader.js";
import {
  safeFailAction,
  safeResponseFailAction,
} from "../../common/validation.js";
import {
  caseDataQuery,
  caseKeyParams,
} from "../schemas/case-request.schema.js";
import { caseDataResponseSchema } from "../schemas/case-response.schema.js";
import { operatorHeaders } from "../schemas/operator-headers.schema.js";
import { viewCaseDataUseCase } from "../use-cases/view-case-data.use-case.js";

export const viewCaseDataRoute = {
  method: "GET",
  path: "/actuators/cases/{workflowCode}/{caseRef}",
  options: {
    description:
      "One case's summary and stored size; with include=document, also the stored document without caseworker notes. 404 with reason CASE_NOT_FOUND when there is no such case.",
    auth: "public-api",
    tags: ["api", "public-api"],
    plugins: {
      "hapi-swagger": { security: [{ serviceToken: [] }] },
    },
    ext: { onPostAuth: { method: requireCaseReader } },
    cache: { otherwise: "no-store" },
    validate: {
      headers: operatorHeaders,
      params: caseKeyParams,
      query: caseDataQuery,
      failAction: safeFailAction,
    },
    response: {
      schema: caseDataResponseSchema,
      failAction: safeResponseFailAction,
    },
  },
  handler(request) {
    const { workflowCode, caseRef } = request.params;

    return viewCaseDataUseCase({
      workflowCode,
      caseRef,
      include: request.query.include,
      operator: operatorOf(request),
      caller: request.auth.credentials.service,
    });
  },
};
