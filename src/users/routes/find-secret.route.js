export const findSecretRoute = {
  method: "GET",
  path: "/secret",
  options: {
    description: "Temp route to test auth",
    tags: ["api"],
    auth: {
      mode: "required",
      strategy: "entra",
    },
  },
  async handler(request) {
    return request.auth.credentials;
  },
};
