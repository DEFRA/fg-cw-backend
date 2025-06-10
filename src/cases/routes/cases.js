import Joi from "joi";
import {
  caseCreateController,
  caseDetailController,
  caseListController,
  caseStageController,
  caseTaskCompleteController,
} from "../controllers/case.controller.js";
import { caseSchema } from "../schemas/case.schema.js";
import { ListResponse, ValidationError } from "../schemas/common.schema.js";

export const casesRoutes = [
  {
    method: "POST",
    path: "/cases",
    options: {
      description: "Temporary: Create a case",
      tags: ["api"],
      validate: {
        payload: caseSchema.CaseData,
      },
      response: {
        status: {
          201: caseSchema.Case,
          400: ValidationError,
        },
      },
    },
    handler: caseCreateController,
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
          pageSize: Joi.number().integer().optional(),
        }),
      },
      response: {
        status: {
          200: ListResponse,
          400: ValidationError,
        },
      },
    },
    handler: caseListController,
  },
  {
    method: "GET",
    path: "/cases/{caseId}",
    options: {
      description: "Find a case by caseId",
      tags: ["api"],
      validate: {
        params: Joi.object({
          caseId: Joi.string().hex().length(24),
        }),
      },
      response: {
        status: {
          200: caseSchema.Case,
          400: ValidationError,
        },
      },
    },
    handler: caseDetailController,
  },
  {
    method: "POST",
    path: "/cases/{caseId}/task",
    options: {
      description: "Complete a task",
      tags: ["api"],
      validate: {
        params: Joi.object({
          caseId: Joi.string().hex().length(24),
        }),
        payload: Joi.object({
          caseId: Joi.string(),
          isComplete: Joi.boolean(),
          taskId: Joi.string(),
          groupId: Joi.string(),
        }),
      },
      response: {
        status: {
          400: ValidationError,
        },
      },
    },
    handler: caseTaskCompleteController,
  },
  {
    method: "POST",
    path: "/cases/{caseId}/stage",
    options: {
      description: "Update the current stage for a case with id caseId",
      tags: ["api"],
      validate: {
        params: Joi.object({
          caseId: Joi.string().hex().length(24),
        }),
      },
      response: {
        status: {
          400: ValidationError,
        },
      },
    },
    handler: caseStageController,
  },
];
