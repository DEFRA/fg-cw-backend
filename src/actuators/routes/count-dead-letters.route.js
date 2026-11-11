import { refuse } from "../../common/buckets/refusal.js";
import {
  bucketFailAction,
  safeResponseFailAction,
} from "../../common/validation.js";
import {
  MAX_WINDOW_MS,
  deadLettersQuerySchema,
  deadLettersResponseSchema,
} from "../schemas/dead-letters.schema.js";
import { operatorHeaders } from "../schemas/operator-headers.schema.js";
import { countDeadLettersUseCase } from "../use-cases/count-dead-letters.use-case.js";

const assertWindow = ({ from, to }) => {
  const span = Date.parse(to) - Date.parse(from);

  if (span < 0) {
    throw refuse("INVALID_RANGE");
  }

  if (span > MAX_WINDOW_MS) {
    throw refuse("INVALID_REQUEST");
  }
};

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
    assertWindow(request.query);

    return countDeadLettersUseCase({
      from: request.query.from,
      to: request.query.to,
    });
  },
};
