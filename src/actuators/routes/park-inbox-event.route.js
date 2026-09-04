import { inboxRowSchema } from "../schemas/box-page-response.schema.js";
import { actorQuery } from "../schemas/box-query.schema.js";
import { eventIdParams } from "../schemas/event-id.schema.js";
import { parkBodySchema } from "../schemas/park-body.schema.js";
import { parkInboxEventUseCase } from "../use-cases/park-inbox-event.use-case.js";

// `by` is a query parameter, not a body key, so park, unpark and redrive all
// take the actor the same way - only park has a body at all.
export const parkInboxEventRoute = {
  method: "POST",
  path: "/actuators/inbox/{id}/park",
  options: {
    description:
      "Park one DEAD_LETTER inbox event: mark it poison and take it out of the retry loop for good. 409 when the row is in any other status.",
    auth: "public-api",
    tags: ["api", "public-api"],
    plugins: {
      "hapi-swagger": { security: [{ serviceToken: [] }] },
    },
    validate: {
      params: eventIdParams,
      query: actorQuery,
      payload: parkBodySchema,
    },
    response: {
      schema: inboxRowSchema,
      failAction: "log",
    },
  },
  handler(request) {
    return parkInboxEventUseCase(request.params.id, {
      reason: request.payload.reason,
      by: request.query.by ?? null,
    });
  },
};
