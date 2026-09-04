import { inboxRowSchema } from "../schemas/box-page-response.schema.js";
import { actorQuery } from "../schemas/box-query.schema.js";
import { eventIdParams } from "../schemas/event-id.schema.js";
import { redriveInboxEventUseCase } from "../use-cases/redrive-inbox-event.use-case.js";

export const redriveInboxEventRoute = {
  method: "POST",
  path: "/actuators/inbox/{id}/redrive",
  options: {
    description:
      "Put one DEAD_LETTER inbox event back in front of the poller. 409 when the row is in any other status.",
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
      schema: inboxRowSchema,
      failAction: "log",
    },
  },
  handler(request) {
    return redriveInboxEventUseCase(request.params.id, {
      by: request.query.by ?? null,
    });
  },
};
