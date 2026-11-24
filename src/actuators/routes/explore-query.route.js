import { operatorOf } from "../../common/actor-header.js";
import { clientGoneSignal } from "../../common/client-gone.js";
import { checkPart } from "../../common/explore/large-answers.js";
import {
  MAX_QUERY_BYTES,
  querySchema,
} from "../../common/explore/query-schema.js";
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
      "This service's part of one Explore query: rows per box, the groups it counted, or the documents of the rows asked for.",
    auth: "public-api",
    tags: ["api", "public-api"],
    plugins: {
      "hapi-swagger": { security: [{ serviceToken: [] }] },
    },
    cache: { otherwise: "no-store" },
    // Every mode takes a fetch's bound: hapi reads the body before its mode.
    payload: { maxBytes: MAX_QUERY_BYTES },
    validate: {
      headers: exploreHeaders,
      payload: querySchema,
      failAction: exploreFailAction,
    },
    response: {
      schema: (part, { context }) =>
        checkPart(part, { query: context.payload }),
      failAction: safeResponseFailAction,
    },
  },
  handler(request) {
    return exploreQueryUseCase({
      query: request.payload,
      operator: operatorOf(request),
      timeLeftMs: request.headers["x-explore-time-left-ms"],
      signal: clientGoneSignal(request),
    });
  },
};
