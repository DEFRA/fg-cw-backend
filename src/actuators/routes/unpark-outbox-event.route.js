import { outboxRowSchema } from "../schemas/box-page-response.schema.js";
import { actorQuery } from "../schemas/box-query.schema.js";
import { eventIdParams } from "../schemas/event-id.schema.js";
import { unparkOutboxEventUseCase } from "../use-cases/unpark-outbox-event.use-case.js";

// PARKED -> DEAD_LETTER. Deliberately does not retry the row: it lands back
// where it was parked from, and a redrive is the separate, explicit next step.
export const unparkOutboxEventRoute = {
  method: "POST",
  path: "/actuators/outbox/{id}/unpark",
  options: {
    description:
      "Unpark one PARKED outbox event back to DEAD_LETTER. 409 when the row is in any other status.",
    auth: "public-api",
    tags: ["api", "public-api"],
    plugins: {
      "hapi-swagger": { security: [{ serviceToken: [] }] },
    },
    validate: {
      params: eventIdParams,
      query: actorQuery,
    },
    response: {
      schema: outboxRowSchema,
      failAction: "log",
    },
  },
  handler(request) {
    return unparkOutboxEventUseCase(request.params.id);
  },
};
