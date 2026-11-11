import {
  bucketFailAction,
  safeResponseFailAction,
} from "../../common/validation.js";
import {
  deadLettersQuerySchema,
  deadLettersResponseSchema,
} from "../schemas/dead-letters.schema.js";
import { operatorHeaders } from "../schemas/operator-headers.schema.js";
import { countDeadLettersUseCase } from "../use-cases/count-dead-letters.use-case.js";

export const countDeadLettersRoute = {
  method: "GET",
  path: "/actuators/dead-letters",
  options: {
    description:
      "Dead letters in each bucket that holds them, in two-hour bins from `from` to `to` by when each event was created, audit events counted as the lists count them. Every match is read; a bin's count is shown up to the count cap and says when it is over.",
    auth: "public-api",
    tags: ["api", "public-api"],
    plugins: {
      "hapi-swagger": { security: [{ serviceToken: [] }] },
    },
    cache: { otherwise: "no-store" },
    validate: {
      headers: operatorHeaders,
      query: deadLettersQuerySchema,
      failAction: bucketFailAction,
    },
    response: {
      schema: deadLettersResponseSchema,
      failAction: safeResponseFailAction,
    },
  },
  handler(request) {
    return countDeadLettersUseCase({
      from: request.query.from,
      to: request.query.to,
    });
  },
};
