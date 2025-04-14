import Joi from "joi";
import { commonSchema } from "../schema/common.schema.js";
import {
  workflowCreateController,
  workflowDetailController,
  workflowListController
} from "../controller/workflow.controller.js";
import { workflowSchema } from "../schema/workflow.schema.js";

const workflows = [
  {
    method: "POST",
    path: "/workflows",
    options: {
      description: "Create a workflow",
      tags: ["api"],
      validate: {
        payload: workflowSchema.WorkflowData
      },
      response: {
        status: {
          201: workflowSchema.Workflow,
          400: commonSchema.ValidationError
        }
      }
    },
    handler: workflowCreateController
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
          pageSize: Joi.number().integer()
        })
      },
      response: {
        status: {
          200: commonSchema.ListResponse,
          400: commonSchema.ValidationError
        }
      }
    },
    handler: workflowListController
  },
  {
    method: "GET",
    path: "/workflows/{workflowCode}",
    options: {
      description: "Find a workflow by workflowCode",
      tags: ["api"],
      validate: {
        params: Joi.object({
          workflowCode: Joi.string()
        })
      },
      response: {
        status: {
          200: workflowSchema.Workflow,
          400: commonSchema.ValidationError
        }
      }
    },
    handler: workflowDetailController
  }
];

export { workflows };
