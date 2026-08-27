// TODO: placeholder for the real service management endpoints
export const findBoxesRoute = {
  method: "GET",
  path: "/actuators/boxes",
  options: {
    description: "Placeholder service management endpoint",
    auth: "public-api",
    tags: ["api", "public-api"],
    plugins: {
      "hapi-swagger": { security: [{ serviceToken: [] }] },
    },
  },
  handler(request) {
    return {
      boxes: [],
      caller: request.auth.credentials.service,
    };
  },
};
