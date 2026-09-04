import { outboxPageResponseSchema } from "../schemas/box-page-response.schema.js";
import { boxListQuery } from "../schemas/box-query.schema.js";
import { findOutboxPageUseCase } from "../use-cases/find-outbox-page.use-case.js";

export const findOutboxRoute = {
  method: "GET",
  path: "/actuators/outbox",
  options: {
    description: "List outbox events, newest first",
    auth: "public-api",
    tags: ["api", "public-api"],
    plugins: {
      "hapi-swagger": { security: [{ serviceToken: [] }] },
    },
    validate: {
      query: boxListQuery,
    },
    response: {
      schema: outboxPageResponseSchema,
      failAction: "log",
    },
  },
  handler(request) {
    const { cursor, direction, pageSize, status, q, from, to } = request.query;

    return findOutboxPageUseCase({
      cursor,
      direction,
      pageSize,
      status,
      q,
      from,
      to,
    });
  },
};
