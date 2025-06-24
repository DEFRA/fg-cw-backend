import Boom from "@hapi/boom";
import { MongoServerError, ObjectId } from "mongodb";
import { describe, expect, it, vi } from "vitest";
import { db } from "../../common/mongo-client.js";
import { UserDocument } from "../models/user-document.js";
import { User } from "../models/user.js";
import { findAll, findById, save, update } from "./user.repository.js";

vi.mock("../../common/mongo-client.js");

describe("save", () => {
  it("creates a user and returns it", async () => {
    const insertOne = vi.fn().mockResolvedValue({
      acknowledged: true,
    });

    db.collection.mockReturnValue({
      insertOne,
    });

    const user = User.createMock();

    await save(user);

    expect(db.collection).toHaveBeenCalledWith("users");

    expect(insertOne).toHaveBeenCalledWith(
      UserDocument.createMock({
        id: user.id,
      }),
    );
  });

  it("throws Boom.conflict when idpId exists", async () => {
    const error = new MongoServerError("E11000 duplicate key error collection");
    error.code = 11000;

    db.collection.mockReturnValue({
      insertOne: vi.fn().mockRejectedValue(error),
    });

    const user = User.createMock();

    await expect(save(user)).rejects.toThrow(
      Boom.conflict(`User with the same idpId already exists`),
    );
  });

  it("throws when an error occurs", async () => {
    const error = new Error("Unexpected error");

    const insertOne = vi.fn().mockRejectedValue(error);

    db.collection.mockReturnValue({
      insertOne,
    });

    const user = User.createMock();

    await expect(save(user)).rejects.toThrow(error);
  });

  it("throws when write is unacknowledged", async () => {
    const insertOne = vi.fn().mockResolvedValue({
      acknowledged: false,
    });

    db.collection.mockReturnValue({
      insertOne,
    });

    const user = User.createMock();

    await expect(save(user)).rejects.toThrow(
      Boom.internal(
        "User could not be created, the operation was not acknowledged",
      ),
    );
  });
});

describe("update", () => {
  it("updates a user", async () => {
    const user = User.createMock();

    const updateOne = vi.fn().mockResolvedValue({
      acknowledged: true,
      matchedCount: 1,
    });

    db.collection.mockReturnValue({
      updateOne,
    });

    await update(user);

    expect(db.collection).toHaveBeenCalledWith("users");

    expect(updateOne).toHaveBeenCalledWith(
      { _id: ObjectId.createFromHexString(user.id) },
      { $set: UserDocument.createMock({ id: user.id }) },
    );
  });

  it("throws Boom.notFound when user is not found", async () => {
    const user = User.createMock();

    db.collection.mockReturnValue({
      updateOne: vi.fn().mockResolvedValue({
        acknowledged: true,
        matchedCount: 0,
      }),
    });

    await expect(update(user)).rejects.toThrow(
      Boom.notFound(`User with id ${user.id} not found`),
    );
  });

  it("throws when write is unacknowledged", async () => {
    const user = User.createMock();

    db.collection.mockReturnValue({
      updateOne: vi.fn().mockResolvedValue({
        matchedCount: 1,
        acknowledged: false,
      }),
    });

    await expect(update(user)).rejects.toThrow(
      Boom.internal(
        "User could not be updated, the operation was not acknowledged",
      ),
    );
  });
});

describe("findAll", () => {
  it("returns a list of users", async () => {
    const docs = [UserDocument.createMock(), UserDocument.createMock()];

    db.collection.mockReturnValue({
      find: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue(docs),
      }),
    });

    const result = await findAll();

    expect(db.collection).toHaveBeenCalledWith("users");

    expect(result).toEqual([
      User.createMock({
        id: docs[0]._id.toString(),
      }),
      User.createMock({
        id: docs[1]._id.toString(),
      }),
    ]);
  });

  it("returns a list of users filtered by idpId", async () => {
    const idpId = "test-idp-id";

    const docs = [UserDocument.createMock({ idpId })];

    const find = vi.fn().mockReturnValue({
      toArray: vi.fn().mockResolvedValue(docs),
    });

    db.collection.mockReturnValue({
      find,
    });

    const result = await findAll({ idpId });

    expect(db.collection).toHaveBeenCalledWith("users");
    expect(find).toHaveBeenCalledWith({ idpId });

    expect(result).toEqual([
      User.createMock({
        id: docs[0]._id.toString(),
        idpId,
      }),
    ]);
  });
});

describe("findById", () => {
  it("returns a user by id", async () => {
    const userDocument = UserDocument.createMock();
    const userId = userDocument._id.toString();

    const findOne = vi.fn().mockReturnValue(userDocument);

    db.collection.mockReturnValue({
      findOne,
    });

    const result = await findById(userId);

    expect(db.collection).toHaveBeenCalledWith("users");

    expect(findOne).toHaveBeenCalledWith({
      _id: userDocument._id,
    });

    expect(result).toEqual(
      User.createMock({
        id: userId,
      }),
    );
  });

  it("returns null when no user is found", async () => {
    const userId = "6800c9feb76f8f854ebf901a";

    db.collection.mockReturnValue({
      findOne: vi.fn().mockResolvedValue(null),
    });

    const result = await findById(userId);

    expect(result).toEqual(null);
  });
});
