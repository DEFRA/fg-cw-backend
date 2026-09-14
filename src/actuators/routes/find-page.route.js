import { pageQuery } from "../schemas/box-query.schema.js";
import { pageResponseSchema } from "../schemas/page-response.schema.js";
import { findPageUseCase } from "../use-cases/find-page.use-case.js";

export const findPageRoute = {
  method: "GET",
  path: "/actuators/events",
  options: {
    description:
      "Both boxes in one read: rows, counts and breakdown, or only the " +
      "`sections` asked for. Each box pages forward, newest first, from its " +
      "own cursor.",
    auth: "public-api",
    tags: ["api", "public-api"],
    plugins: {
      "hapi-swagger": { security: [{ serviceToken: [] }] },
    },
    validate: {
      query: pageQuery,
    },
    response: {
      schema: pageResponseSchema,
      failAction: "log",
    },
  },
  handler(request) {
    const {
      inboxCursor,
      outboxCursor,
      pageSize,
      status,
      sections,
      q,
      error,
      from,
      to,
      audit,
    } = request.query;

    return findPageUseCase({
      inboxCursor,
      outboxCursor,
      pageSize,
      status,
      sections,
      q,
      error,
      from,
      to,
      audit,
    });
  },
};
