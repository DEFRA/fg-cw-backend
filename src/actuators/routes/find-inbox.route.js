import Joi from "joi";
import { inboxPageResponseSchema } from "../schemas/box-page-response.schema.js";
import { findInboxPageUseCase } from "../use-cases/find-inbox-page.use-case.js";

const MIN_PAGE_SIZE = 1;
const MAX_PAGE_SIZE = 50;
const DEFAULT_PAGE_SIZE = 20;

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
      query: Joi.object({
        cursor: Joi.string(),
        direction: Joi.string().valid("forward", "backward").default("forward"),
        pageSize: Joi.number()
          .integer()
          .min(MIN_PAGE_SIZE)
          .max(MAX_PAGE_SIZE)
          .default(DEFAULT_PAGE_SIZE),
        status: Joi.string().valid(
          "PUBLISHED",
          "PROCESSING",
          "FAILED",
          "RESUBMITTED",
          "COMPLETED",
          "DEAD_LETTER",
        ),
      }),
    },
    response: {
      schema: inboxPageResponseSchema,
      failAction: "log",
    },
  },
  handler(request) {
    const { cursor, direction, pageSize, status } = request.query;

    return findInboxPageUseCase({ cursor, direction, pageSize, status });
  },
};
