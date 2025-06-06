import { eventController } from "../controllers/event.controller.js";
import { caseSchema } from "../schemas/case.schema.js";
import { commonSchema } from "../schemas/common.schema.js";

export const caseEvents = [
  {
    method: "POST",
    path: "/case-events",
    options: {
      description: "Receive a create case event",
      tags: ["api"],
      validate: {
        payload: caseSchema.GrantCaseEvent,
      },
      response: {
        status: {
          201: caseSchema.Case,
          400: commonSchema.ValidationError,
        },
      },
    },
    handler: eventController,
  },
];
