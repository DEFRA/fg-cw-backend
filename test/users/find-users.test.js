import { MongoClient } from "mongodb";
import { env } from "node:process";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { wreck } from "../helpers/wreck.js";

let users;
let client;

beforeAll(async () => {
  client = new MongoClient(env.MONGO_URI);
  await client.connect();
  users = client.db().collection("users");
});

afterAll(async () => {
  await client.close(true);
});

describe("GET /users", () => {
  beforeEach(async () => {
    await users.deleteMany({});
  });

  it("finds users", async () => {
    await wreck.post("/users", {
      payload: {
        idpId: "abcd1234-5678-90ab-cdef-1234567890ab",
        firstName: "Name",
        lastName: "Surname",
        email: "name.surname@defra.gov.uk",
        idpRoles: ["defra-idp"],
        appRoles: ["cw-app"],
      },
    });

    await wreck.post("/users", {
      payload: {
        idpId: "7467b7e2-1022-45fd-9e81-ab364206de40",
        firstName: "Another",
        lastName: "User",
        email: "another.user@defra.gov.uk",
        idpRoles: ["defra-idp"],
        appRoles: ["cw-app"],
      },
    });

    const response = await wreck.get("/users");

    expect(response).toEqual({
      res: expect.objectContaining({
        statusCode: 200,
      }),
      payload: [
        {
          id: expect.any(String),
          idpId: "abcd1234-5678-90ab-cdef-1234567890ab",
          firstName: "Name",
          lastName: "Surname",
          email: "name.surname@defra.gov.uk",
          idpRoles: ["defra-idp"],
          appRoles: ["cw-app"],
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        },
        {
          id: expect.any(String),
          idpId: "7467b7e2-1022-45fd-9e81-ab364206de40",
          firstName: "Another",
          lastName: "User",
          email: "another.user@defra.gov.uk",
          idpRoles: ["defra-idp"],
          appRoles: ["cw-app"],
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        },
      ],
    });
  });

  it("returns an empty array if no users are found", async () => {
    const response = await wreck.get("/users");

    expect(response).toEqual({
      res: expect.objectContaining({
        statusCode: 200,
      }),
      payload: [],
    });
  });

  it("returns users filtered by idpId", async () => {
    await wreck.post("/users", {
      payload: {
        idpId: "abcd1234-5678-90ab-cdef-1234567890ab",
        firstName: "Name",
        lastName: "Surname",
        email: "name.surname@defra.gov.uk",
        idpRoles: ["defra-idp"],
        appRoles: ["cw-app"],
      },
    });

    await wreck.post("/users", {
      payload: {
        idpId: "7467b7e2-1022-45fd-9e81-ab364206de40",
        firstName: "Another",
        lastName: "User",
        email: "another.user@defra.gov.uk",
        idpRoles: ["defra-idp"],
        appRoles: ["cw-app"],
      },
    });

    const response = await wreck.get(
      "/users?idpId=abcd1234-5678-90ab-cdef-1234567890ab",
    );

    expect(response).toEqual({
      res: expect.objectContaining({
        statusCode: 200,
      }),
      payload: [
        {
          id: expect.any(String),
          idpId: "abcd1234-5678-90ab-cdef-1234567890ab",
          firstName: "Name",
          lastName: "Surname",
          email: "name.surname@defra.gov.uk",
          idpRoles: ["defra-idp"],
          appRoles: ["cw-app"],
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        },
      ],
    });
  });
});
