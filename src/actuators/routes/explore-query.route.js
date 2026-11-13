import { operatorOf } from "../../common/actor-header.js";
import { clientGoneSignal } from "../../common/client-gone.js";
import { checkPart } from "../../common/explore/large-answers.js";
import { querySchema } from "../../common/explore/query-schema.js";
import {
  exploreFailAction,
  safeResponseFailAction,
} from "../../common/validation.js";
import { exploreHeaders } from "../schemas/operator-headers.schema.js";
import { exploreQueryUseCase } from "../use-cases/explore-query.use-case.js";

// A POST, so what a query asks for travels in the body, never in a logged URL.
export const exploreQueryRoute = {
  method: "POST",
  path: "/actuators/explore/query",
  options: {
    description:
      "This service's part of one Explore query: rows per box, or the groups it counted.",
    auth: "public-api",
    tags: ["api", "public-api"],
    plugins: {
      "hapi-swagger": { security: [{ serviceToken: [] }] },
    },
    cache: { otherwise: "no-store" },
    validate: {
      headers: exploreHeaders,
      payload: querySchema,
      failAction: exploreFailAction,
    },
    response: {
      schema: (part) => checkPart(part),
      failAction: safeResponseFailAction,
    },
  },
  handler(request) {
    return exploreQueryUseCase({
      query: request.payload,
      operator: operatorOf(request),
      caller: request.auth.credentials.service,
      timeLeftMs: request.headers["x-explore-time-left-ms"],
      signal: clientGoneSignal(request),
    });
  },
};
