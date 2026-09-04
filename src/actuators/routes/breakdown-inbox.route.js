import { boxBreakdownResponseSchema } from "../schemas/box-breakdown-response.schema.js";
import { boxBreakdownQuery } from "../schemas/box-query.schema.js";
import { breakdownInboxUseCase } from "../use-cases/breakdown-inbox.use-case.js";

// ROUTE ORDER - `/actuators/inbox/breakdown` and `/actuators/inbox/{id}`
// differ only in their last segment. hapi prefers a literal segment over a
// parameter so this wins regardless of registration order, and `{id}` is
// additionally constrained to 24 hex characters (schemas/event-id.schema.js),
// which "breakdown" is not. Both guards are deliberate, and index.test.js
// asserts a request for this path reaches this route rather than the detail one.
export const breakdownInboxRoute = {
  method: "GET",
  path: "/actuators/inbox/breakdown",
  options: {
    description:
      "Group the inbox's DEAD_LETTER events by failure message and event type, commonest first",
    auth: "public-api",
    tags: ["api", "public-api"],
    plugins: {
      "hapi-swagger": { security: [{ serviceToken: [] }] },
    },
    validate: {
      query: boxBreakdownQuery,
    },
    response: {
      schema: boxBreakdownResponseSchema,
      failAction: "log",
    },
  },
  handler(request) {
    const { q, error, from, to } = request.query;

    return breakdownInboxUseCase({ q, error, from, to });
  },
};
