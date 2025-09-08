import { env } from "node:process";
import { describe, expect, it } from "vitest";
import { wreck } from "../helpers/wreck.js";

describe("GET /secret", () => {
  it("finds secrets", async () => {
    const tokenResponse = await wreck.post(env.OIDC_SIGN_TOKEN_ENDPOINT, {
      payload: {
        clientId: "client1",
        username: "admin@t.gov.uk",
      },
    });

    const response = await wreck.get("/secret", {
      headers: {
        Authorization: `Bearer ${tokenResponse.payload.access_token}`,
      },
    });

    expect(response).toEqual({
      res: expect.objectContaining({
        statusCode: 200,
      }),
      payload: {
        raw: {
          idpId: "9f6b80d3-99d3-42dc-ac42-b184595b1ef1",
          idpRoles: ["FCP.Casework.Admin"],
          name: "Test Admin",
        },
        user: null,
      },
    });
  });
});
