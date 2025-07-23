import Joi from "joi";

export const authRoute = {
  method: "POST",
  path: "/auth/token",
  options: {
    auth: {
      mode: "required",
      strategy: "jwt",
    },
    description: "Accept an access token and provide a new JWT",
    tags: ["api"],
    validate: {
      headers: Joi.object({
        Authorization: Joi.string()
          .pattern(/^Bearer\s.+$/)
          .description("A custom header for authentication with Bearer token"),
      }).unknown(),
      // payload: authTokenRequestSchema
    },
  },

  async handler(request, h) {
    const authHeader = request.headers["authorization"];

    // Extract and validate the Bearer token
    if (!authHeader.startsWith("Bearer ")) {
      return h
        .response({ error: "Invalid Authorization header format" })
        .code(400);
    }

    const token = authHeader.slice(7); // Remove "Bearer " prefix
    // Validate or use the extracted token as per your logic
    console.log("Token:", token);

    const accessToken = "temp";

    return h.response({ message: "Token received", accessToken }).code(200);
  },
};
