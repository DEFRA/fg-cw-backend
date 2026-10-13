import { operatorOf } from "../../common/actor-header.js";
import { requireCaseReader } from "../../common/require-case-reader.js";
import {
  bucketFailAction,
  safeResponseFailAction,
} from "../../common/validation.js";
import {
  bucketQueryRequestSchema,
  bucketQueryResponseSchema,
} from "../schemas/bucket.schema.js";
import { caseSearchHeaders } from "../schemas/operator-headers.schema.js";
import { queryBucketUseCase } from "../use-cases/query-bucket.use-case.js";

// A POST, so a searched ref travels in the body and never in a logged URL.
export const queryBucketRoute = {
  method: "POST",
  path: "/actuators/buckets/{bucketId}/query",
  options: {
    description:
      "One page of one bucket, newest first, with the groups asked for. Every read is exact or bounded, and says which.",
    auth: "public-api",
    tags: ["api", "public-api"],
    plugins: {
      "hapi-swagger": { security: [{ serviceToken: [] }] },
    },
    ext: { onPostAuth: { method: requireCaseReader } },
    cache: { otherwise: "no-store" },
    validate: {
      headers: caseSearchHeaders,
      payload: bucketQueryRequestSchema,
      failAction: bucketFailAction,
    },
    response: {
      schema: bucketQueryResponseSchema,
      failAction: safeResponseFailAction,
    },
  },
  handler(request) {
    return queryBucketUseCase({
      bucketId: request.params.bucketId,
      body: request.payload,
      operator: operatorOf(request),
      caller: request.auth.credentials.service,
      repeat: request.headers["x-search-repeat"] === "1",
    });
  },
};
