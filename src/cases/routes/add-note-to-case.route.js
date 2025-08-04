import Joi from "joi";
import { HttpCodes } from "../../common/http-codes.js";
import { ValidationError } from "../schemas/common.schema.js";
import { idSchema } from "../schemas/id.schema.js";
import { addNoteToCaseRequestSchema } from "../schemas/requests/add-note-to-case-request.schema.js";
import { addNoteToCaseUseCase } from "../use-cases/add-note-to-case.use-case.js";

export const addNoteToCaseRoute = {
  method: "POST",
  path: "/cases/{caseId}/notes",
  options: {
    description: "Add a note to a case",
    tags: ["api"],
    validate: {
      params: Joi.object({
        caseId: idSchema.required(),
      }),
      payload: addNoteToCaseRequestSchema,
    },
    response: {
      status: {
        [HttpCodes.BadRequest]: ValidationError,
      },
    },
  },
  async handler(request, h) {
    const { caseId } = request.params;
    const { type, content } = request.payload;

    const note = await addNoteToCaseUseCase({
      caseId,
      type,
      content,
    });

    return h.response(note).code(HttpCodes.Created);
  },
};
