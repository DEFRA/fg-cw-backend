import Joi from "joi";
import { idSchema } from "../../common/schemas/user/id.schema.js";
import { updateLoginUseCase } from "../use-cases/update-login.use-case.js";

export const updateLoginRoute = {
  method: "POST",
  path: "/users/{userId}/login",
  options: {
    description: "Update user last login timestamp",
    tags: ["api"],
    validate: {
      params: Joi.object({
        userId: idSchema,
      }),
    },
  },
  async handler(request) {
    const { userId } = request.params;

    return await updateLoginUseCase({ userId });
  },
};
