import Joi from "joi";
import {
  workflowCreateController,
  workflowDetailController,
  workflowListController,
} from "../controllers/workflow.controller.js";
import { commonSchema } from "../schemas/common.schema.js";
import { workflowSchema } from "../schemas/workflow.schema.js";

export const workflows = [
  {
    method: "POST",
    path: "/workflows",
    options: {
      description: "Create a workflow",
      tags: ["api"],
      validate: {
        payload: workflowSchema.WorkflowData,
      },
      response: {
        status: {
          201: workflowSchema.Workflow,
          400: commonSchema.ValidationError,
        },
      },
    },
    handler: workflowCreateController,
  },
  {
    method: "GET",
    path: "/workflows",
    options: {
      description: "Get all workflows",
      tags: ["api"],
      validate: {
        query: Joi.object({
          page: Joi.number().integer(),
          pageSize: Joi.number().integer(),
        }),
      },
      response: {
        status: {
          200: commonSchema.ListResponse,
          400: commonSchema.ValidationError,
        },
      },
    },
    handler: workflowListController,
  },
  {
    method: "GET",
    path: "/workflows/{code}",
    options: {
      description: "Find a workflow by code",
      tags: ["api"],
      validate: {
        params: Joi.object({
          code: Joi.string(),
        }),
      },
      response: {
        status: {
          200: workflowSchema.Workflow,
          400: commonSchema.ValidationError,
        },
      },
    },
    handler: workflowDetailController,
  },
];
