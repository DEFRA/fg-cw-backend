import Boom from "@hapi/boom";
import Joi from "joi";
import { db } from "../../common/mongo-client.js";

export const findCaseIdByRefRoute = {
  method: "GET",
  path: "/cases/ref/{caseRef}",
  options: {
    description: "Find case ID by caseRef (perf test only)",
    tags: ["api"],
    auth: false, // No authentication required
    validate: {
      params: Joi.object({
        caseRef: Joi.string().required(),
      }),
    },
  },
  async handler(request, h) {
    // Only allow in perf test environment
    if (process.env.PERF_TEST_SEED !== "true") {
      throw Boom.notFound("Endpoint not available");
    }

    const { caseRef } = request.params;

    // Query database for case by caseRef
    const caseData = await db
      .collection("cases")
      .findOne({ caseRef }, { projection: { _id: 1, caseRef: 1 } });

    if (!caseData) {
      throw Boom.notFound(`Case with caseRef "${caseRef}" not found`);
    }

    return {
      caseRef: caseData.caseRef,
      caseId: caseData._id.toString(),
    };
  },
};
