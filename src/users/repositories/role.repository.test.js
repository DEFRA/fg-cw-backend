import Boom from "@hapi/boom";
import { MongoServerError } from "mongodb";
import { describe, expect, it, vi } from "vitest";
import { db } from "../../common/mongo-client.js";
import { RoleDocument } from "../models/role-document.js";
import { Role } from "../models/role.js";
import { findAll, findByCode, save } from "./role.repository.js";

vi.mock("../../common/mongo-client.js");

describe("save", () => {
  it("creates a role", async () => {
    const insertOne = vi.fn().mockResolvedValue({
      acknowledged: true,
    });

    db.collection.mockReturnValue({
      insertOne,
    });

    const role = Role.createMock();

    await save(role);

    expect(db.collection).toHaveBeenCalledWith("roles");
    expect(insertOne).toHaveBeenCalledWith(
      RoleDocument.createMock({
        id: role.id,
      }),
    );
  });

  it("throws Boom.conflict when code exists", async () => {
    const error = new MongoServerError("E11000 duplicate key error collection");
    error.code = 11000;

    db.collection.mockReturnValue({
      insertOne: vi.fn().mockRejectedValue(error),
    });

    const role = Role.createMock();

    await expect(save(role)).rejects.toThrow(
      Boom.conflict(`Role with code ${role.code} already exists`),
    );
  });

  it("throws when write is unacknowledged", async () => {
    const insertOne = vi.fn().mockResolvedValue({
      acknowledged: false,
    });

    db.collection.mockReturnValue({
      insertOne,
    });

    const role = Role.createMock();

    await expect(save(role)).rejects.toThrow(
      Boom.internal(
        `Role with code ${role.code} could not be created, the operation was not acknowledged`,
      ),
    );
  });

  it("throws when an error occurs", async () => {
    const error = new Error("Unexpected error");

    const insertOne = vi.fn().mockRejectedValue(error);

    db.collection.mockReturnValue({
      insertOne,
    });

    const role = Role.createMock();

    await expect(save(role)).rejects.toThrow(error);
  });
});

describe("findAll", () => {
  it("returns all roles", async () => {
    const docs = [RoleDocument.createMock(), RoleDocument.createMock()];

    db.collection.mockReturnValue({
      find: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue(docs),
      }),
    });

    const result = await findAll();

    expect(db.collection).toHaveBeenCalledWith("roles");
    expect(result).toHaveLength(2);
    expect(result[0]).toBeInstanceOf(Role);
    expect(result[1]).toBeInstanceOf(Role);
  });

  it("returns an empty array when no roles exist", async () => {
    db.collection.mockReturnValue({
      find: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue([]),
      }),
    });

    const result = await findAll();

    expect(result).toEqual([]);
  });
});

describe("findByCode", () => {
  it("finds a role by code", async () => {
    const roleDocument = RoleDocument.createMock();
    const roleCode = "ROLE_RPA_CASES_APPROVE";

    const findOne = vi.fn().mockReturnValue(roleDocument);

    db.collection.mockReturnValue({
      findOne,
    });

    const result = await findByCode(roleCode);

    expect(db.collection).toHaveBeenCalledWith("roles");
    expect(findOne).toHaveBeenCalledWith({
      code: roleCode,
    });
    expect(result).toBeInstanceOf(Role);
    expect(result.code).toBe(roleDocument.code);
  });

  it("returns null when role not found", async () => {
    const roleCode = "NonExistent.Code";

    db.collection.mockReturnValue({
      findOne: vi.fn().mockResolvedValue(null),
    });

    const result = await findByCode(roleCode);

    expect(result).toEqual(null);
  });
});
