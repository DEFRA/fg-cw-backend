import { describe, expect, it } from "vitest";
import { wreck } from "../helpers/wreck.js";

describe("GET /secret", () => {
  it("finds secrets", async () => {
    const response = await wreck.get("/secret");

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
