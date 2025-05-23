import Joi from "joi";
import {
  caseCreateController,
  caseDetailController,
  caseListController,
  caseStageController
} from "../controller/handlers.controller.js";
import { caseSchema } from "../schema/case.schema.js";
import { commonSchema } from "../schema/common.schema.js";

const cases = [
  {
    method: "POST",
    path: "/cases",
    options: {
      description: "Temporary: Create a handlers",
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
      validate: {
        query: Joi.object({
          page: Joi.number().integer().optional(),
          pageSize: Joi.number().integer().optional()
        })
      },
      response: {
        status: {
          200: commonSchema.ListResponse,
          400: commonSchema.ValidationError
        }
      }
    },
    handler: caseListController
  },
  {
    method: "GET",
    path: "/cases/{caseId}",
    options: {
      description: "Find a handlers by caseId",
      tags: ["api"],
      validate: {
        params: Joi.object({
          caseId: Joi.string().hex().length(24)
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
  },
  {
    method: "POST",
    path: "/cases/{caseId}/stage",
    options: {
      description: "Update the current stage for a handlers with id caseId",
      tags: ["api"],
      validate: {
        params: Joi.object({
          caseId: Joi.string().hex().length(24)
        })
      },
      response: {
        status: {
          400: commonSchema.ValidationError
        }
      }
    },
    handler: caseStageController
  }
];

export { cases };
