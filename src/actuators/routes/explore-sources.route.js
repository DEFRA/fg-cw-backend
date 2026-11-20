import { sourcesSchema } from "../../common/explore/query-schema.js";
import { safeResponseFailAction } from "../../common/validation.js";
import { exploreSourcesUseCase } from "../use-cases/explore-sources.use-case.js";

export const exploreSourcesRoute = {
  method: "GET",
  path: "/actuators/explore/sources",
  options: {
    description:
      "The Explore sources: each one's paths, with their types, indexes and known values.",
    auth: "public-api",
    tags: ["api", "public-api"],
    plugins: {
      "hapi-swagger": { security: [{ serviceToken: [] }] },
    },
    response: {
      schema: sourcesSchema,
      failAction: safeResponseFailAction,
    },
  },
  handler() {
    return exploreSourcesUseCase();
  },
};
