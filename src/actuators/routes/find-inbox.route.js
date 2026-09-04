import { inboxPageResponseSchema } from "../schemas/box-page-response.schema.js";
import { boxListQuery } from "../schemas/box-query.schema.js";
import { findInboxPageUseCase } from "../use-cases/find-inbox-page.use-case.js";

export const findInboxRoute = {
  method: "GET",
  path: "/actuators/inbox",
  options: {
    description: "List inbox events, newest first",
    auth: "public-api",
    tags: ["api", "public-api"],
    plugins: {
      "hapi-swagger": { security: [{ serviceToken: [] }] },
    },
    validate: {
      query: boxListQuery,
    },
    response: {
      schema: inboxPageResponseSchema,
      failAction: "log",
    },
  },
  handler(request) {
    const { cursor, direction, pageSize, status, q, from, to } = request.query;

    return findInboxPageUseCase({
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
