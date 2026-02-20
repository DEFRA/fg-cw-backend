import Boom from "@hapi/boom";
import { MongoServerError, ObjectId } from "mongodb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../../common/mongo-client.js";
import { UserDocument } from "../models/user-document.js";
import { User } from "../models/user.js";
import {
  findAll,
  findByEmail,
  findById,
  save,
  update,
  upsertLogin,
} from "./user.repository.js";

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
    error.keyPattern = { idpId: 1 };

    db.collection.mockReturnValue({
      insertOne: vi.fn().mockRejectedValue(error),
    });

    const user = User.createMock();

    await expect(save(user)).rejects.toThrow(
      Boom.conflict("User with the same idpId already exists"),
    );
  });

  it("throws Boom.conflict when email exists", async () => {
    const error = new MongoServerError("E11000 duplicate key error collection");
    error.code = 11000;
    error.keyPattern = { email: 1 };

    db.collection.mockReturnValue({
      insertOne: vi.fn().mockRejectedValue(error),
    });

    const user = User.createMock();

    await expect(save(user)).rejects.toThrow(
      Boom.conflict("A user with this email address already exists"),
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

const expectedNameFilter = {
  name: {
    $exists: true,
    $nin: [null, ""],
    $not: { $regex: /^placeholder$/i },
  },
};

const now = new Date("2026-02-19T12:00:00.000Z");
const today = "2026-02-19";

const createExpectedActiveAppRoleFilter = (role) => ({
  $and: [
    {
      [`appRoles.${role}`]: {
        $exists: true,
      },
    },
    {
      $or: [
        {
          [`appRoles.${role}.startDate`]: null,
        },
        {
          [`appRoles.${role}.startDate`]: {
            $lte: today,
          },
        },
      ],
    },
    {
      $or: [
        {
          [`appRoles.${role}.endDate`]: null,
        },
        {
          [`appRoles.${role}.endDate`]: {
            $gte: today,
          },
        },
      ],
    },
  ],
});

describe("findAll", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const setupFindMock = () => {
    const docs = [UserDocument.createMock()];
    const find = vi.fn().mockReturnValue({
      toArray: vi.fn().mockResolvedValue(docs),
    });

    db.collection.mockReturnValue({
      find,
    });

    return find;
  };

  it("returns a list of users", async () => {
    const docs = [UserDocument.createMock(), UserDocument.createMock()];

    const find = vi.fn().mockReturnValue({
      toArray: vi.fn().mockResolvedValue(docs),
    });

    db.collection.mockReturnValue({
      find,
    });

    const result = await findAll();

    expect(db.collection).toHaveBeenCalledWith("users");
    expect(find).toHaveBeenCalledWith(expectedNameFilter);

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
    expect(find).toHaveBeenCalledWith({ ...expectedNameFilter, idpId });

    expect(result).toEqual([
      User.createMock({
        id: docs[0]._id.toString(),
        idpId,
      }),
    ]);
  });

  it("returns a list of users filtered by allAppRoles", async () => {
    const allAppRoles = ["ROLE_1", "ROLE_2"];
    const anyAppRoles = [];

    const docs = [UserDocument.createMock()];

    const find = vi.fn().mockReturnValue({
      toArray: vi.fn().mockResolvedValue(docs),
    });

    db.collection.mockReturnValue({
      find,
    });

    const result = await findAll({ allAppRoles, anyAppRoles });

    expect(db.collection).toHaveBeenCalledWith("users");
    expect(find).toHaveBeenCalledWith({
      ...expectedNameFilter,
      $and: [
        createExpectedActiveAppRoleFilter("ROLE_1"),
        createExpectedActiveAppRoleFilter("ROLE_2"),
      ],
    });

    expect(result).toEqual([
      User.createMock({
        id: docs[0]._id.toString(),
      }),
    ]);
  });

  it("returns a list of users filtered by anyAppRoles", async () => {
    const allAppRoles = [];
    const anyAppRoles = ["ROLE_3"];

    const docs = [UserDocument.createMock()];

    const find = vi.fn().mockReturnValue({
      toArray: vi.fn().mockResolvedValue(docs),
    });

    db.collection.mockReturnValue({
      find,
    });

    const result = await findAll({ allAppRoles, anyAppRoles });

    expect(db.collection).toHaveBeenCalledWith("users");
    expect(find).toHaveBeenCalledWith({
      ...expectedNameFilter,
      $or: [createExpectedActiveAppRoleFilter("ROLE_3")],
    });

    expect(result).toEqual([
      User.createMock({
        id: docs[0]._id.toString(),
      }),
    ]);
  });

  it("returns a list of users filtered by allAppRoles and anyAppRoles", async () => {
    const allAppRoles = ["ROLE_1", "ROLE_2"];
    const anyAppRoles = ["ROLE_3"];

    const docs = [UserDocument.createMock()];

    const find = vi.fn().mockReturnValue({
      toArray: vi.fn().mockResolvedValue(docs),
    });

    db.collection.mockReturnValue({
      find,
    });

    const result = await findAll({ allAppRoles, anyAppRoles });

    expect(db.collection).toHaveBeenCalledWith("users");
    expect(find).toHaveBeenCalledWith({
      ...expectedNameFilter,
      $and: [
        createExpectedActiveAppRoleFilter("ROLE_1"),
        createExpectedActiveAppRoleFilter("ROLE_2"),
      ],
      $or: [createExpectedActiveAppRoleFilter("ROLE_3")],
    });

    expect(result).toEqual([
      User.createMock({
        id: docs[0]._id.toString(),
      }),
    ]);
  });

  it("includes null startDate wildcard in app role validity filter", async () => {
    const find = setupFindMock();

    await findAll({ allAppRoles: ["ROLE_1"] });

    expect(find).toHaveBeenCalledWith({
      ...expectedNameFilter,
      $and: [createExpectedActiveAppRoleFilter("ROLE_1")],
    });
  });

  it("includes null endDate wildcard in app role validity filter", async () => {
    const find = setupFindMock();

    await findAll({ anyAppRoles: ["ROLE_2"] });

    expect(find).toHaveBeenCalledWith({
      ...expectedNameFilter,
      $or: [createExpectedActiveAppRoleFilter("ROLE_2")],
    });
  });

  it("uses startDate <= today guard for future-role exclusion", async () => {
    const find = setupFindMock();

    await findAll({ allAppRoles: ["ROLE_3"] });

    expect(find).toHaveBeenCalledWith({
      ...expectedNameFilter,
      $and: [createExpectedActiveAppRoleFilter("ROLE_3")],
    });
  });

  it("uses endDate >= today guard for expired-role exclusion", async () => {
    const find = setupFindMock();

    await findAll({ anyAppRoles: ["ROLE_4"] });

    expect(find).toHaveBeenCalledWith({
      ...expectedNameFilter,
      $or: [createExpectedActiveAppRoleFilter("ROLE_4")],
    });
  });

  it("contains both null wildcard branches so roles with no dates are valid", async () => {
    const find = setupFindMock();

    await findAll({ allAppRoles: ["ROLE_5"] });

    const roleFilter = find.mock.calls[0][0].$and[0];

    expect(roleFilter.$and[1].$or).toContainEqual({
      "appRoles.ROLE_5.startDate": null,
    });
    expect(roleFilter.$and[2].$or).toContainEqual({
      "appRoles.ROLE_5.endDate": null,
    });
  });

  it("returns a list of users filtered by ids", async () => {
    const id1 = new ObjectId();
    const id2 = new ObjectId();

    const ids = [id1.toHexString(), id2.toHexString()];

    const docs = [
      UserDocument.createMock({ _id: ids[0] }),
      UserDocument.createMock({ _id: ids[1] }),
    ];

    const find = vi.fn().mockReturnValue({
      toArray: vi.fn().mockResolvedValue(docs),
    });

    db.collection.mockReturnValue({
      find,
    });

    const result = await findAll({ ids });

    expect(db.collection).toHaveBeenCalledWith("users");
    expect(find).toHaveBeenCalledWith({
      ...expectedNameFilter,
      _id: { $in: [id1, id2] },
    });

    expect(result).toEqual([
      User.createMock({
        id: docs[0]._id.toString(),
      }),
      User.createMock({
        id: docs[1]._id.toString(),
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

describe("upsert", () => {
  it("creates a new user when idpId does not exist", async () => {
    const user = User.createMock();
    const userDocument = new UserDocument(user);

    const findOne = vi.fn().mockResolvedValue(null);
    const findOneAndUpdate = vi
      .fn()
      .mockResolvedValueOnce(null) // First attempt: no idpId match
      .mockResolvedValueOnce(UserDocument.createMock({ id: user.id })); // Third attempt: upsert success

    db.collection.mockReturnValue({
      findOne,
      findOneAndUpdate,
    });

    const result = await upsertLogin(user);

    expect(db.collection).toHaveBeenCalledWith("users");

    // 1. Try update by idpId
    expect(findOneAndUpdate).toHaveBeenNthCalledWith(
      1,
      { idpId: userDocument.idpId },
      expect.objectContaining({ $set: expect.any(Object) }),
      { returnDocument: "after" },
    );

    // 2. Check for manual user (using exact lowercase email, not regex)
    expect(findOne).toHaveBeenCalledWith({
      email: userDocument.email,
      createdManually: true,
    });

    // 3. Perform upsert
    expect(findOneAndUpdate).toHaveBeenNthCalledWith(
      2,
      { idpId: userDocument.idpId },
      expect.objectContaining({
        $set: {
          name: userDocument.name,
          email: userDocument.email,
          idpRoles: userDocument.idpRoles,
          updatedAt: userDocument.updatedAt,
          lastLoginAt: userDocument.lastLoginAt,
        },
        $setOnInsert: {
          createdAt: userDocument.createdAt,
          appRoles: userDocument.appRoles,
        },
      }),
      {
        upsert: true,
        returnDocument: "after",
      },
    );

    expect(result).toEqual(
      User.createMock({
        id: user.id,
      }),
    );
  });

  it("updates an existing user when idpId exists", async () => {
    const user = User.createMock({
      idpId: "existing-idp-id",
      name: "Updated Name",
      email: "updated.name@defra.gov.uk",
    });

    const existingDoc = UserDocument.createMock({
      idpId: "existing-idp-id",
      name: "Updated Name",
    });

    const findOneAndUpdate = vi.fn().mockResolvedValue(existingDoc);

    db.collection.mockReturnValue({
      findOneAndUpdate,
    });

    const result = await upsertLogin(user);

    expect(db.collection).toHaveBeenCalledWith("users");

    // Should only call findOneAndUpdate once and not call findOne
    expect(findOneAndUpdate).toHaveBeenCalledTimes(1);
    expect(findOneAndUpdate).toHaveBeenCalledWith(
      { idpId: user.idpId },
      expect.any(Object),
      { returnDocument: "after" },
    );

    expect(result.idpId).toBe("existing-idp-id");
    expect(result.name).toBe("Updated Name");
  });

  it("throws when findOneAndUpdate returns null", async () => {
    const user = User.createMock();

    const findOne = vi.fn().mockResolvedValue(null);
    const findOneAndUpdate = vi.fn().mockResolvedValue(null);

    db.collection.mockReturnValue({
      findOne,
      findOneAndUpdate,
    });

    await expect(upsertLogin(user)).rejects.toThrow(
      Boom.internal("User could not be created or updated"),
    );
  });

  it("throws Boom.conflict when duplicate email race condition occurs", async () => {
    const user = User.createMock({
      idpId: "new-entra-id",
      email: "duplicate@defra.gov.uk",
    });

    const error = new MongoServerError("E11000 duplicate key error");
    error.code = 11000;
    error.keyPattern = { email: 1 };

    const findOne = vi.fn().mockResolvedValue(null); // No manual user found
    const findOneAndUpdate = vi
      .fn()
      .mockResolvedValueOnce(null) // 1. idpId match fails
      .mockRejectedValueOnce(error); // 2. Upsert fails due to duplicate email

    db.collection.mockReturnValue({
      findOne,
      findOneAndUpdate,
    });

    await expect(upsertLogin(user)).rejects.toThrow(
      Boom.conflict("A user with this email address already exists"),
    );
  });

  it("links manually-created user on first Entra ID login", async () => {
    const user = User.createMock({
      idpId: "new-entra-id",
      email: "manual@defra.gov.uk",
    });

    const manualUserDoc = UserDocument.createMock({
      _id: new ObjectId(),
      email: "manual@defra.gov.uk",
      createdManually: true,
    });

    const findOne = vi.fn().mockResolvedValue(manualUserDoc);
    const findOneAndUpdate = vi
      .fn()
      .mockResolvedValueOnce(null) // 1. idpId match fails
      .mockResolvedValueOnce({
        ...manualUserDoc,
        idpId: "new-entra-id",
        createdManually: false,
        updatedAt: new Date(),
        lastLoginAt: new Date(),
      }); // 2. Linking success

    db.collection.mockReturnValue({
      findOne,
      findOneAndUpdate,
    });

    const result = await upsertLogin(user);

    // 1. Try update by idpId
    expect(findOneAndUpdate).toHaveBeenNthCalledWith(
      1,
      { idpId: user.idpId },
      expect.any(Object),
      { returnDocument: "after" },
    );

    // 2. Check for manual user (exact match on normalized email)
    expect(findOne).toHaveBeenCalledWith({
      email: "manual@defra.gov.uk",
      createdManually: true,
    });

    // 3. Link manual user
    expect(findOneAndUpdate).toHaveBeenNthCalledWith(
      2,
      { _id: manualUserDoc._id },
      expect.objectContaining({
        $set: expect.objectContaining({
          idpId: "new-entra-id",
          createdManually: false,
        }),
      }),
      { returnDocument: "after" },
    );

    expect(result.idpId).toBe("new-entra-id");
    expect(result.createdManually).toBe(false);
  });

  it("does not link if user was not created manually", async () => {
    const user = User.createMock({
      idpId: "new-entra-id",
      email: "existing@defra.gov.uk",
    });

    const findOne = vi.fn().mockResolvedValue(null);
    const findOneAndUpdate = vi
      .fn()
      .mockResolvedValueOnce(null) // 1. idpId match fails
      .mockResolvedValueOnce(
        UserDocument.createMock({ idpId: "new-entra-id" }),
      ); // 3. Upsert success

    db.collection.mockReturnValue({
      findOne,
      findOneAndUpdate,
    });

    await upsertLogin(user);

    // 1. Try update by idpId
    expect(findOneAndUpdate).toHaveBeenNthCalledWith(
      1,
      { idpId: "new-entra-id" },
      expect.any(Object),
      { returnDocument: "after" },
    );

    // 2. Check for manual user (exact match on normalized email)
    expect(findOne).toHaveBeenCalledWith({
      email: "existing@defra.gov.uk",
      createdManually: true,
    });

    // 3. Final upsert
    expect(findOneAndUpdate).toHaveBeenNthCalledWith(
      2,
      { idpId: "new-entra-id" },
      expect.any(Object),
      { upsert: true, returnDocument: "after" },
    );
  });
});

describe("findByEmail", () => {
  it("returns a user by email (normalizes to lowercase)", async () => {
    const userDocument = UserDocument.createMock();
    const userId = userDocument._id.toString();

    const findOne = vi.fn().mockReturnValue(userDocument);

    db.collection.mockReturnValue({
      findOne,
    });

    // Input has mixed case, but query should use lowercase
    const result = await findByEmail("Bob.Bill@defra.gov.uk");

    expect(db.collection).toHaveBeenCalledWith("users");

    // Should query with exact lowercase email, not regex
    expect(findOne).toHaveBeenCalledWith({
      email: "bob.bill@defra.gov.uk",
    });

    expect(result).toEqual(
      User.createMock({
        id: userId,
      }),
    );
  });

  it("returns null when no user is found", async () => {
    db.collection.mockReturnValue({
      findOne: vi.fn().mockResolvedValue(null),
    });

    const result = await findByEmail("nonexistent@example.com");

    expect(result).toEqual(null);
  });

  it("returns null when email is null", async () => {
    const result = await findByEmail(null);

    expect(result).toEqual(null);
  });

  it("returns null when email is undefined", async () => {
    const result = await findByEmail(undefined);

    expect(result).toEqual(null);
  });

  it("returns null when email is not a string", async () => {
    const result = await findByEmail(123);

    expect(result).toEqual(null);
  });
});
