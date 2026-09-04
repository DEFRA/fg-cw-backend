import { inboxRowSchema } from "../schemas/box-page-response.schema.js";
import { actorQuery } from "../schemas/box-query.schema.js";
import { eventIdParams } from "../schemas/event-id.schema.js";
import { unparkInboxEventUseCase } from "../use-cases/unpark-inbox-event.use-case.js";

// PARKED -> DEAD_LETTER. Deliberately does not retry the row: it lands back
// where it was parked from, and a redrive is the separate, explicit next step.
export const unparkInboxEventRoute = {
  method: "POST",
  path: "/actuators/inbox/{id}/unpark",
  options: {
    description:
      "Unpark one PARKED inbox event back to DEAD_LETTER. 409 when the row is in any other status.",
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
    return unparkInboxEventUseCase(request.params.id);
  },
};
