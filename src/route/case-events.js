import { commonSchema } from "../schema/common.schema.js";
import { caseSchema } from "../schema/case.schema.js";
import { eventController } from "../controller/event.controller.js";

const caseEvents = [
  {
    method: "POST",
    path: "/handlers-events",
    options: {
      description: "Receive a create handlers event",
      tags: ["api"],
      validate: {
        payload: caseSchema.GrantCaseEvent
      },
      response: {
        status: {
          201: caseSchema.Case,
          400: commonSchema.ValidationError
        }
      }
    },
    handler: eventController
  }
];

export { caseEvents };
