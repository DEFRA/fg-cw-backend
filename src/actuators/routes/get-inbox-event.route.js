import { inboxDetailResponseSchema } from "../schemas/box-detail-response.schema.js";
import { eventIdParams } from "../schemas/event-id.schema.js";
import { getInboxEventUseCase } from "../use-cases/get-inbox-event.use-case.js";

export const getInboxEventRoute = {
  method: "GET",
  path: "/actuators/inbox/{id}",
  options: {
    description:
      "Get one inbox event in full, including its stored event payload",
    auth: "public-api",
    tags: ["api", "public-api"],
    plugins: {
      "hapi-swagger": { security: [{ serviceToken: [] }] },
    },
    validate: {
      params: eventIdParams,
    },
    response: {
      schema: inboxDetailResponseSchema,
      failAction: "log",
    },
  },
  handler(request) {
    return getInboxEventUseCase(request.params.id);
  },
};
