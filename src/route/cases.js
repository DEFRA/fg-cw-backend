import Joi from "joi";
import {
  caseCreateController,
  caseDetailController,
  caseListController
} from "../controller/case.controller.js";
import { caseSchema } from "../schema/case.schema.js";
import { commonSchema } from "../schema/common.schema.js";

const cases = [
  {
    method: "POST",
    path: "/cases",
    options: {
      description: "Temporary: Create a case",
      tags: ["api"],
      validate: {
        payload: caseSchema.CaseData
      },
      response: {
        status: {
          201: caseSchema.Case,
          400: commonSchema.ValidationError
        }
      }
    },
    handler: caseCreateController
  },
  {
    method: "GET",
    path: "/cases",
    options: {
      description: "Get all cases",
      tags: ["api"],
      response: {
        status: {
          200: Joi.array().items(caseSchema.Case).label("Cases")
        }
      }
    },
    handler: caseListController
  },
  {
    method: "GET",
    path: "/cases/{caseId}",
    options: {
      description: "Find a case by caseId",
      tags: ["api"],
      validate: {
        params: Joi.object({
          caseId: Joi.string()
        })
      },
      response: {
        status: {
          200: caseSchema.Case,
          400: commonSchema.ValidationError
        }
      }
    },
    handler: caseDetailController
  }
];

export { cases };
