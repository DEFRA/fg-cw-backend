import Inert from "@hapi/inert";
import Vision from "@hapi/vision";
import HapiSwagger from "hapi-swagger";
import { config } from "../../common/config.js";

export const swagger = {
  name: "swagger",
  async register(server) {
    await server.register([
      Inert,
      Vision,
      {
        plugin: HapiSwagger,
        options: {
          info: {
            title: "Case Working Service",
            version: config.get("serviceVersion"),
          },
          securityDefinitions: {
            jwt: {
              type: "apiKey",
              name: "Authorization",
              in: "header",
              description: "Enter token e.g. 'Bearer token..'",
            },
          },
          security: [
            {
              jwt: [],
            },
          ],
        },
      },
    ]);
  },
};
