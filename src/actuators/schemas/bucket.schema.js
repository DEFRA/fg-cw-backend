import Joi from "joi";
import {
  catalogueEntrySchema,
  queryRequestSchema,
  queryResponseSchema,
  summaryRequestSchema,
  summaryResponseSchema,
  timelineRequestSchema,
  timelineResponseSchema,
} from "../../common/buckets/schema.js";

export const bucketQueryRequestSchema =
  queryRequestSchema.label("BucketQueryRequest");

export const bucketQueryResponseSchema = queryResponseSchema.label(
  "BucketQueryResponse",
);

export const bucketSummaryRequestSchema = summaryRequestSchema.label(
  "BucketSummaryRequest",
);

export const bucketSummaryResponseSchema = summaryResponseSchema.label(
  "BucketSummaryResponse",
);

export const bucketTimelineRequestSchema = timelineRequestSchema.label(
  "BucketTimelineRequest",
);

export const bucketTimelineResponseSchema = timelineResponseSchema.label(
  "BucketTimelineResponse",
);

export const bucketCatalogueResponseSchema = Joi.object({
  buckets: Joi.array()
    .items(catalogueEntrySchema.label("BucketCatalogueEntry"))
    .required(),
}).label("BucketCatalogueResponse");
