import Joi from "joi";

export const authRoute = {
  method: "POST",
  path: "/auth/token",
  options: {
    description: "Accept an access token",
    tags: ["api"],
    validate: {
      payload: {
        accessToken: Joi.string().required(),
      },
    },
  },
  async handler(request, h) {
    const { accessToken } = request.payload;

    return h.response({ message: "Token received", accessToken }).code(200);
  },
};
