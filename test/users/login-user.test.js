import { MongoClient } from "mongodb";
import { randomUUID } from "node:crypto";
import { env } from "node:process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { wreck } from "../helpers/wreck.js";

let client;

beforeAll(async () => {
  client = new MongoClient(env.MONGO_URI);
  await client.connect();
});

afterAll(async () => {
  await client.close(true);
});

describe("POST /users/login", () => {
  const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

  it("logs in a user successfully", async () => {
    const payload = {
      idpId: randomUUID(),
      name: "Test User",
      email: "test@example.com",
      idpRoles: ["some-role"],
    };

    const response = await wreck.post("/users/login", {
      payload,
    });

    expect(response).toEqual({
      res: expect.objectContaining({
        statusCode: 200,
      }),
      payload: expect.objectContaining({
        id: expect.any(String),
        idpId: payload.idpId,
        name: payload.name,
        email: payload.email,
        idpRoles: payload.idpRoles,
        lastLoginAt: expect.stringMatching(ISO_DATE_REGEX),
      }),
    });
  });

  it("updates user details on subsequent login", async () => {
    const idpId = randomUUID();
    const originalEmail = "test-update-original@example.com";
    const updatedEmail = "test-update-updated@example.com";

    // First login
    await wreck.post("/users/login", {
      payload: {
        idpId,
        name: "Original Name",
        email: originalEmail,
        idpRoles: ["Role1"],
      },
    });

    // Second login with updated details
    const response = await wreck.post("/users/login", {
      payload: {
        idpId,
        name: "Updated Name",
        email: updatedEmail,
        idpRoles: ["Role1", "Role2"],
      },
    });

    expect(response).toEqual({
      res: expect.objectContaining({
        statusCode: 200,
      }),
      payload: expect.objectContaining({
        id: expect.any(String),
        idpId,
        email: updatedEmail,
        name: "Updated Name",
        idpRoles: ["Role1", "Role2"],
        lastLoginAt: expect.stringMatching(ISO_DATE_REGEX),
      }),
    });
  });

  it("sets correct timestamps (createdAt, updatedAt, lastLoginAt)", async () => {
    const idpId = randomUUID();
    const email = "test-timestamps@example.com";

    const payload = {
      idpId,
      name: "Test User Timestamps",
      email,
      idpRoles: ["Role1"],
    };

    // First Login
    const response1 = await wreck.post("/users/login", {
      payload,
    });

    const createdAt1 = response1.payload.createdAt;
    const updatedAt1 = response1.payload.updatedAt;
    const lastLoginAt1 = response1.payload.lastLoginAt;

    expect(createdAt1).toEqual(expect.stringMatching(ISO_DATE_REGEX));
    expect(updatedAt1).toEqual(expect.stringMatching(ISO_DATE_REGEX));
    expect(lastLoginAt1).toEqual(expect.stringMatching(ISO_DATE_REGEX));

    // Wait a bit to ensure timestamp difference
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Second Login
    const response2 = await wreck.post("/users/login", {
      payload,
    });

    const createdAt2 = response2.payload.createdAt;
    const updatedAt2 = response2.payload.updatedAt;
    const lastLoginAt2 = response2.payload.lastLoginAt;

    // createdAt should remain the same
    expect(createdAt2).toBe(createdAt1);

    // updatedAt and lastLoginAt should have updated
    expect(new Date(updatedAt2).getTime()).toBeGreaterThan(
      new Date(updatedAt1).getTime(),
    );
    expect(new Date(lastLoginAt2).getTime()).toBeGreaterThan(
      new Date(lastLoginAt1).getTime(),
    );
  });

  it("returns 400 when payload is invalid", async () => {
    const payload = {
      idpId: randomUUID(),
      name: "Test User 3",
      email: "test3@example.com",
      // Missing idpRoles
    };

    await expect(
      wreck.post("/users/login", {
        payload,
      }),
    ).rejects.toThrow("Response Error: 400 Bad Request");
  });
});
