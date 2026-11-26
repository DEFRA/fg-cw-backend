import { eventIdParams } from "../schemas/event-id.schema.js";
import { eventStatusResponseSchema } from "../schemas/event-status-response.schema.js";
import { getInboxEventStatusUseCase } from "../use-cases/get-inbox-event-status.use-case.js";

export const getInboxEventStatusRoute = {
  method: "GET",
  path: "/actuators/events/inbox/{id}/status",
  options: {
    description:
      "The status of one inbox event and its attempts against the retry cap, without its payload. 404 when there is no such event.",
    auth: "public-api",
    tags: ["api", "public-api"],
    plugins: {
      "hapi-swagger": { security: [{ serviceToken: [] }] },
    },
    validate: {
      params: eventIdParams,
    },
    response: {
      schema: eventStatusResponseSchema,
      failAction: "log",
    },
  },
  handler(request) {
    return getInboxEventStatusUseCase({ id: request.params.id });
  },
};
