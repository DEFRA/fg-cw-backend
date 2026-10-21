import { requireCaseReader } from "../../common/require-case-reader.js";
import {
  bucketFailAction,
  safeResponseFailAction,
} from "../../common/validation.js";
import {
  bucketTimelineRequestSchema,
  bucketTimelineResponseSchema,
} from "../schemas/bucket.schema.js";
import { caseSearchHeaders } from "../schemas/operator-headers.schema.js";
import { readTimelineUseCase } from "../use-cases/read-timeline.use-case.js";

// A POST, so the record's ref travels in the body and never in a logged URL.
export const readTimelineRoute = {
  method: "POST",
  path: "/actuators/timeline",
  options: {
    description:
      "The newest events that carry one ref, from every timeline bucket of this service, each bucket answered apart.",
    auth: "public-api",
    tags: ["api", "public-api"],
    plugins: {
      "hapi-swagger": { security: [{ serviceToken: [] }] },
    },
    ext: { onPostAuth: { method: requireCaseReader } },
    cache: { otherwise: "no-store" },
    validate: {
      headers: caseSearchHeaders,
      payload: bucketTimelineRequestSchema,
      failAction: bucketFailAction,
    },
    response: {
      schema: bucketTimelineResponseSchema,
      failAction: safeResponseFailAction,
    },
  },
  handler(request) {
    return readTimelineUseCase({ ref: request.payload.ref });
  },
};
