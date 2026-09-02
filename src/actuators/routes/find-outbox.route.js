import Joi from "joi";
import { outboxPageResponseSchema } from "../schemas/box-page-response.schema.js";
import { findOutboxPageUseCase } from "../use-cases/find-outbox-page.use-case.js";

const MIN_PAGE_SIZE = 1;
const MAX_PAGE_SIZE = 50;
const DEFAULT_PAGE_SIZE = 20;

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
      schema: outboxPageResponseSchema,
      failAction: "log",
    },
  },
  handler(request) {
    const { cursor, direction, pageSize, status } = request.query;

    return findOutboxPageUseCase({ cursor, direction, pageSize, status });
  },
};
