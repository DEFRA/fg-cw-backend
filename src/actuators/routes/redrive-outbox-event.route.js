import { outboxRowSchema } from "../schemas/box-page-response.schema.js";
import { actorQuery } from "../schemas/box-query.schema.js";
import { eventIdParams } from "../schemas/event-id.schema.js";
import { redriveOutboxEventUseCase } from "../use-cases/redrive-outbox-event.use-case.js";

export const redriveOutboxEventRoute = {
  method: "POST",
  path: "/actuators/outbox/{id}/redrive",
  options: {
    description:
      "Put one DEAD_LETTER outbox event back in front of the poller. 409 when the row is in any other status.",
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
    return redriveOutboxEventUseCase(request.params.id, {
      by: request.query.by ?? null,
    });
  },
};
