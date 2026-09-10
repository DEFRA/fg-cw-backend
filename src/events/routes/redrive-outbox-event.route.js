import { outboxRowSchema } from "../schemas/box-page-response.schema.js";
import { actorQuery } from "../schemas/box-query.schema.js";
import { eventIdParams } from "../schemas/event-id.schema.js";
import { redriveOutboxEventUseCase } from "../use-cases/redrive-outbox-event.use-case.js";

export const redriveOutboxEventRoute = {
  method: "POST",
  path: "/actuators/events/outbox/{id}/redrive",
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
    return redriveOutboxEventUseCase({
      id: request.params.id,
      // The operator GAS forwarded, and the service client GAS authenticated
      // as - both land in this service's own audit record of the redrive.
      by: request.query.by ?? null,
      caller: request.auth.credentials?.service ?? null,
    });
  },
};
