import Joi from "joi";
import { safeResponseFailAction } from "../../common/validation.js";
import { bucketCatalogueResponseSchema } from "../schemas/bucket.schema.js";
import { listBucketsUseCase } from "../use-cases/list-buckets.use-case.js";

export const listBucketsRoute = {
  method: "GET",
  path: "/actuators/buckets",
  options: {
    description:
      "Every list this service can show the admin surface, with its filters, groupings and columns.",
    auth: "public-api",
    tags: ["api", "public-api"],
    plugins: {
      "hapi-swagger": { security: [{ serviceToken: [] }] },
    },
    // `fields` only when asked for, since a GAS before field searches refuses
    // an entry that carries it.
    validate: {
      query: Joi.object({ include: Joi.string().valid("fields") }),
    },
    response: {
      schema: bucketCatalogueResponseSchema,
      failAction: safeResponseFailAction,
    },
  },
  handler(request) {
    return listBucketsUseCase({
      withFields: request.query.include === "fields",
    });
  },
};
