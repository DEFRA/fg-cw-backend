import { eventIdParams } from "../schemas/event-id.schema.js";
import { eventStatusResponseSchema } from "../schemas/event-status-response.schema.js";
import { getOutboxEventStatusUseCase } from "../use-cases/get-outbox-event-status.use-case.js";

export const getOutboxEventStatusRoute = {
  method: "GET",
  path: "/actuators/events/outbox/{id}/status",
  options: {
    description:
      "The status of one outbox event and its attempts against the retry cap, without its payload. 404 when there is no such event.",
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
    return getOutboxEventStatusUseCase({ id: request.params.id });
  },
};
