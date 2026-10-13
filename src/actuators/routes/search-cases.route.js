import { operatorOf } from "../../common/actor-header.js";
import { requireCaseReader } from "../../common/require-case-reader.js";
import {
  safeFailAction,
  safeResponseFailAction,
} from "../../common/validation.js";
import { caseSearchPayload } from "../schemas/case-request.schema.js";
import { caseSearchResponseSchema } from "../schemas/case-response.schema.js";
import { caseSearchHeaders } from "../schemas/operator-headers.schema.js";
import { searchCasesUseCase } from "../use-cases/search-cases.use-case.js";

export const searchCasesRoute = {
  method: "POST",
  path: "/actuators/cases/search",
  options: {
    description:
      "Cases newest first, 20 a page from a cursor; or, with a ref, every case in that ref's series on one page. A first page also carries a capped total and the workflow codes.",
    auth: "public-api",
    tags: ["api", "public-api"],
    plugins: {
      "hapi-swagger": { security: [{ serviceToken: [] }] },
    },
    ext: { onPostAuth: { method: requireCaseReader } },
    cache: { otherwise: "no-store" },
    validate: {
      headers: caseSearchHeaders,
      payload: caseSearchPayload,
      failAction: safeFailAction,
    },
    response: {
      schema: caseSearchResponseSchema,
      failAction: safeResponseFailAction,
    },
  },
  handler(request) {
    return searchCasesUseCase({
      query: request.payload ?? {},
      operator: operatorOf(request),
      caller: request.auth.credentials.service,
      repeat: request.headers["x-search-repeat"] === "1",
    });
  },
};
