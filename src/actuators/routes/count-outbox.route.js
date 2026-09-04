import { boxCountsResponseSchema } from "../schemas/box-counts-response.schema.js";
import { boxCountsQuery } from "../schemas/box-query.schema.js";
import { countOutboxUseCase } from "../use-cases/count-outbox.use-case.js";

// ROUTE ORDER - `/actuators/outbox/counts` and `/actuators/outbox/{id}` differ
// only in their last segment. hapi prefers a literal segment over a parameter
// so this wins regardless of registration order, and `{id}` is additionally
// constrained to 24 hex characters (schemas/event-id.schema.js), which
// "counts" is not. Both guards are deliberate, and index.test.js asserts a
// request for the counts path reaches this route rather than the detail one.
export const countOutboxRoute = {
  method: "GET",
  path: "/actuators/outbox/counts",
  options: {
    description: "Count outbox events per status for the given filter",
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

    return countOutboxUseCase({ q, error, from, to });
  },
};
