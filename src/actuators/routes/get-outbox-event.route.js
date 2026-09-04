import { outboxDetailResponseSchema } from "../schemas/box-detail-response.schema.js";
import { eventIdParams } from "../schemas/event-id.schema.js";
import { getOutboxEventUseCase } from "../use-cases/get-outbox-event.use-case.js";

export const getOutboxEventRoute = {
  method: "GET",
  path: "/actuators/outbox/{id}",
  options: {
    description:
      "Get one outbox event in full, including its stored event payload",
    auth: "public-api",
    tags: ["api", "public-api"],
    plugins: {
      "hapi-swagger": { security: [{ serviceToken: [] }] },
    },
    validate: {
      params: eventIdParams,
    },
    response: {
      schema: outboxDetailResponseSchema,
      failAction: "log",
    },
  },
  handler(request) {
    return getOutboxEventUseCase(request.params.id);
  },
};
