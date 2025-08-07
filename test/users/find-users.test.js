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
        name: "Name",
        email: "name.surname@defra.gov.uk",
        idpRoles: ["defra-idp"],
        appRoles: ["ROLE_RPA_CASES_APPROVE"],
      },
    });

    await wreck.post("/users", {
      payload: {
        idpId: "7467b7e2-1022-45fd-9e81-ab364206de40",
        name: "Another",
        email: "another.user@defra.gov.uk",
        idpRoles: ["defra-idp"],
        appRoles: ["ROLE_RPA_CASES_APPROVE"],
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
          name: "Name",
          email: "name.surname@defra.gov.uk",
          idpRoles: ["defra-idp"],
          appRoles: ["ROLE_RPA_CASES_APPROVE"],
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        },
        {
          id: expect.any(String),
          idpId: "7467b7e2-1022-45fd-9e81-ab364206de40",
          name: "Another",
          email: "another.user@defra.gov.uk",
          idpRoles: ["defra-idp"],
          appRoles: ["ROLE_RPA_CASES_APPROVE"],
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
        name: "Name",
        email: "name.surname@defra.gov.uk",
        idpRoles: ["defra-idp"],
        appRoles: ["ROLE_RPA_CASES_APPROVE"],
      },
    });

    await wreck.post("/users", {
      payload: {
        idpId: "7467b7e2-1022-45fd-9e81-ab364206de40",
        name: "Another",
        email: "another.user@defra.gov.uk",
        idpRoles: ["defra-idp"],
        appRoles: ["ROLE_RPA_CASES_APPROVE"],
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
          name: "Name",
          email: "name.surname@defra.gov.uk",
          idpRoles: ["defra-idp"],
          appRoles: ["ROLE_RPA_CASES_APPROVE"],
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        },
      ],
    });
  });

  it("returns users filtered by allAppRoles", async () => {
    await wreck.post("/users", {
      payload: {
        idpId: "abcd1234-5678-90ab-cdef-1234567890ab",
        name: "Name",
        email: "name.surname@defra.gov.uk",
        idpRoles: ["defra-idp"],
        appRoles: ["ROLE_RPA_CASES_APPROVE", "ROLE_RPA_ADMIN"],
      },
    });

    await wreck.post("/users", {
      payload: {
        idpId: "7467b7e2-1022-45fd-9e81-ab364206de40",
        name: "Another",
        email: "another.user@defra.gov.uk",
        idpRoles: ["defra-idp"],
        appRoles: ["ROLE_RPA_CASES_APPROVE"],
      },
    });

    const searchParams = new URLSearchParams();
    searchParams.append("allAppRoles", "ROLE_RPA_CASES_APPROVE");
    searchParams.append("allAppRoles", "ROLE_RPA_ADMIN");

    const response = await wreck.get(`/users?${searchParams}`);

    expect(response).toEqual({
      res: expect.objectContaining({
        statusCode: 200,
      }),
      payload: [
        {
          id: expect.any(String),
          idpId: "abcd1234-5678-90ab-cdef-1234567890ab",
          name: "Name",
          email: "name.surname@defra.gov.uk",
          idpRoles: ["defra-idp"],
          appRoles: ["ROLE_RPA_CASES_APPROVE", "ROLE_RPA_ADMIN"],
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        },
      ],
    });
  });

  it("returns users filtered by anyAppRoles", async () => {
    await wreck.post("/users", {
      payload: {
        idpId: "abcd1234-5678-90ab-cdef-1234567890ab",
        name: "Name",
        email: "name.surname@defra.gov.uk",
        idpRoles: ["defra-idp"],
        appRoles: ["ROLE_RPA_CASES_APPROVE", "ROLE_RPA_ADMIN", "ROLE_ANY_OF"],
      },
    });

    await wreck.post("/users", {
      payload: {
        idpId: "7467b7e2-1022-45fd-9e81-ab364206de40",
        name: "Another",
        email: "another.user@defra.gov.uk",
        idpRoles: ["defra-idp"],
        appRoles: ["ROLE_RPA_CASES_APPROVE"],
      },
    });

    const searchParams = new URLSearchParams();
    searchParams.append("anyAppRoles", "ROLE_ANY_OF");

    const response = await wreck.get(`/users?${searchParams}`);

    expect(response).toEqual({
      res: expect.objectContaining({
        statusCode: 200,
      }),
      payload: [
        {
          id: expect.any(String),
          idpId: "abcd1234-5678-90ab-cdef-1234567890ab",
          name: "Name",
          email: "name.surname@defra.gov.uk",
          idpRoles: ["defra-idp"],
          appRoles: ["ROLE_RPA_CASES_APPROVE", "ROLE_RPA_ADMIN", "ROLE_ANY_OF"],
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        },
      ],
    });
  });

  it("returns users filtered by allAppRoles and anyAppRoles", async () => {
    await wreck.post("/users", {
      payload: {
        idpId: "abcd1234-5678-90ab-cdef-1234567890ab",
        name: "Name",
        email: "name.surname@defra.gov.uk",
        idpRoles: ["defra-idp"],
        appRoles: ["ROLE_RPA_CASES_APPROVE", "ROLE_RPA_ADMIN", "ROLE_ANY_OF"],
      },
    });

    await wreck.post("/users", {
      payload: {
        idpId: "7467b7e2-1022-45fd-9e81-ab364206de40",
        name: "Another",
        email: "another.user@defra.gov.uk",
        idpRoles: ["defra-idp"],
        appRoles: ["ROLE_RPA_CASES_APPROVE"],
      },
    });

    const searchParams = new URLSearchParams();
    searchParams.append("allAppRoles", "ROLE_RPA_CASES_APPROVE");
    searchParams.append("allAppRoles", "ROLE_RPA_ADMIN");
    searchParams.append("anyAppRoles", "ROLE_ANY_OF");

    const response = await wreck.get(`/users?${searchParams}`);

    expect(response).toEqual({
      res: expect.objectContaining({
        statusCode: 200,
      }),
      payload: [
        {
          id: expect.any(String),
          idpId: "abcd1234-5678-90ab-cdef-1234567890ab",
          name: "Name",
          email: "name.surname@defra.gov.uk",
          idpRoles: ["defra-idp"],
          appRoles: ["ROLE_RPA_CASES_APPROVE", "ROLE_RPA_ADMIN", "ROLE_ANY_OF"],
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        },
      ],
    });
  });

  it("returns no users when no match in allAppRoles", async () => {
    await wreck.post("/users", {
      payload: {
        idpId: "abcd1234-5678-90ab-cdef-1234567890ab",
        name: "Name",
        email: "name.surname@defra.gov.uk",
        idpRoles: ["defra-idp"],
        appRoles: ["ROLE_RPA_CASES_APPROVE", "ROLE_RPA_ADMIN", "ROLE_ANY_OF"],
      },
    });

    await wreck.post("/users", {
      payload: {
        idpId: "7467b7e2-1022-45fd-9e81-ab364206de40",
        name: "Another",
        email: "another.user@defra.gov.uk",
        idpRoles: ["defra-idp"],
        appRoles: ["ROLE_RPA_CASES_APPROVE"],
      },
    });

    const searchParams = new URLSearchParams();
    searchParams.append("allAppRoles", "ROLE_NO_MATCH");

    const response = await wreck.get(`/users?${searchParams}`);

    expect(response).toEqual({
      res: expect.objectContaining({
        statusCode: 200,
      }),
      payload: [],
    });
  });

  it("returns no users when no match in anyAppRoles", async () => {
    await wreck.post("/users", {
      payload: {
        idpId: "abcd1234-5678-90ab-cdef-1234567890ab",
        name: "Name",
        email: "name.surname@defra.gov.uk",
        idpRoles: ["defra-idp"],
        appRoles: ["ROLE_RPA_CASES_APPROVE", "ROLE_RPA_ADMIN", "ROLE_ANY_OF"],
      },
    });

    await wreck.post("/users", {
      payload: {
        idpId: "7467b7e2-1022-45fd-9e81-ab364206de40",
        name: "Another",
        email: "another.user@defra.gov.uk",
        idpRoles: ["defra-idp"],
        appRoles: ["ROLE_RPA_CASES_APPROVE"],
      },
    });

    const searchParams = new URLSearchParams();
    searchParams.append("anyAppRoles", "ROLE_NO_MATCH");

    const response = await wreck.get(`/users?${searchParams}`);

    expect(response).toEqual({
      res: expect.objectContaining({
        statusCode: 200,
      }),
      payload: [],
    });
  });

  it("returns no users when no match in allAppRoles and no match in anyAppRoles", async () => {
    await wreck.post("/users", {
      payload: {
        idpId: "abcd1234-5678-90ab-cdef-1234567890ab",
        name: "Name",
        email: "name.surname@defra.gov.uk",
        idpRoles: ["defra-idp"],
        appRoles: ["ROLE_RPA_CASES_APPROVE", "ROLE_RPA_ADMIN", "ROLE_ANY_OF"],
      },
    });

    await wreck.post("/users", {
      payload: {
        idpId: "7467b7e2-1022-45fd-9e81-ab364206de40",
        name: "Another",
        email: "another.user@defra.gov.uk",
        idpRoles: ["defra-idp"],
        appRoles: ["ROLE_RPA_CASES_APPROVE"],
      },
    });

    const searchParams = new URLSearchParams();
    searchParams.append("allAppRoles", "ROLE_NO_MATCH_ALL");
    searchParams.append("anyAppRoles", "ROLE_NO_MATCH_ANY");

    const response = await wreck.get(`/users?${searchParams}`);

    expect(response).toEqual({
      res: expect.objectContaining({
        statusCode: 200,
      }),
      payload: [],
    });
  });
});
