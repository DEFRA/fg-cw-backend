import { pageQuery } from "../schemas/box-query.schema.js";
import { pageResponseSchema } from "../schemas/page-response.schema.js";
import { findPageUseCase } from "../use-cases/find-page.use-case.js";

export const findPageRoute = {
  method: "GET",
  path: "/actuators/events",
  options: {
    description:
      "Both boxes in one read: rows, counts and breakdown. Each box pages by " +
      "its own cursor; a box asked with direction=backward and no cursor of " +
      "its own answers with its LAST page, so a merged pager must keep an " +
      "exhausted box's cursor rather than dropping it.",
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
      direction,
      pageSize,
      status,
      q,
      error,
      from,
      to,
      audit,
    } = request.query;

    return findPageUseCase({
      inboxCursor,
      outboxCursor,
      direction,
      pageSize,
      status,
      q,
      error,
      from,
      to,
      audit,
    });
  },
};
