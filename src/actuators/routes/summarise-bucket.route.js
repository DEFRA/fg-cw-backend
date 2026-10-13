import { requireCaseReader } from "../../common/require-case-reader.js";
import {
  bucketFailAction,
  safeResponseFailAction,
} from "../../common/validation.js";
import {
  bucketSummaryRequestSchema,
  bucketSummaryResponseSchema,
} from "../schemas/bucket.schema.js";
import { caseSearchHeaders } from "../schemas/operator-headers.schema.js";
import { summariseBucketUseCase } from "../use-cases/summarise-bucket.use-case.js";

export const summariseBucketRoute = {
  method: "POST",
  path: "/actuators/buckets/{bucketId}/summaries/{summaryId}",
  options: {
    description:
      "One summary a bucket declares: the values of its fact among the rows it picks out, most frequent first, each count an index read.",
    auth: "public-api",
    tags: ["api", "public-api"],
    plugins: {
      "hapi-swagger": { security: [{ serviceToken: [] }] },
    },
    ext: { onPostAuth: { method: requireCaseReader } },
    cache: { otherwise: "no-store" },
    validate: {
      headers: caseSearchHeaders,
      payload: bucketSummaryRequestSchema,
      failAction: bucketFailAction,
    },
    response: {
      schema: bucketSummaryResponseSchema,
      failAction: safeResponseFailAction,
    },
  },
  handler(request) {
    return summariseBucketUseCase({
      bucketId: request.params.bucketId,
      summaryId: request.params.summaryId,
      body: request.payload,
    });
  },
};
