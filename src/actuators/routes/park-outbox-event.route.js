import { outboxRowSchema } from "../schemas/box-page-response.schema.js";
import { actorQuery } from "../schemas/box-query.schema.js";
import { eventIdParams } from "../schemas/event-id.schema.js";
import { parkBodySchema } from "../schemas/park-body.schema.js";
import { parkOutboxEventUseCase } from "../use-cases/park-outbox-event.use-case.js";

// `by` is a query parameter, not a body key, so park, unpark and redrive all
// take the actor the same way - only park has a body at all.
export const parkOutboxEventRoute = {
  method: "POST",
  path: "/actuators/outbox/{id}/park",
  options: {
    description:
      "Park one DEAD_LETTER outbox event: mark it poison and take it out of the retry loop for good. 409 when the row is in any other status.",
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
      schema: outboxRowSchema,
      failAction: "log",
    },
  },
  handler(request) {
    return parkOutboxEventUseCase(request.params.id, {
      reason: request.payload.reason,
      by: request.query.by ?? null,
    });
  },
};
