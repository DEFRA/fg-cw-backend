import { boxCountsResponseSchema } from "../schemas/box-counts-response.schema.js";
import { boxCountsQuery } from "../schemas/box-query.schema.js";
import { countInboxUseCase } from "../use-cases/count-inbox.use-case.js";

// ROUTE ORDER - `/actuators/inbox/counts` and `/actuators/inbox/{id}` differ
// only in their last segment. hapi prefers a literal segment over a parameter
// so this wins regardless of registration order, and `{id}` is additionally
// constrained to 24 hex characters (schemas/event-id.schema.js), which
// "counts" is not. Both guards are deliberate, and index.test.js asserts a
// request for the counts path reaches this route rather than the detail one.
export const countInboxRoute = {
  method: "GET",
  path: "/actuators/inbox/counts",
  options: {
    description: "Count inbox events per status for the given filter",
    auth: "public-api",
    tags: ["api", "public-api"],
    plugins: {
      "hapi-swagger": { security: [{ serviceToken: [] }] },
    },
    validate: {
      query: boxCountsQuery,
    },
    response: {
      schema: boxCountsResponseSchema,
      failAction: "log",
    },
  },
  handler(request) {
    const { q, error, from, to } = request.query;

    return countInboxUseCase({ q, error, from, to });
  },
};
