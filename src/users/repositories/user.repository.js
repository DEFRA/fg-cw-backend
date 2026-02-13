import Boom from "@hapi/boom";
import { ObjectId } from "mongodb";
import { db } from "../../common/mongo-client.js";
import { AppRole } from "../models/app-role.js";
import { UserDocument } from "../models/user-document.js";
import { User } from "../models/user.js";

const collection = "users";

const toUser = (doc) => {
  const appRoles = {};
  for (const [roleName, roleData] of Object.entries(doc.appRoles)) {
    appRoles[roleName] = new AppRole({
      name: roleName,
      startDate: roleData.startDate,
      endDate: roleData.endDate,
    });
  }

  return new User({
    id: doc._id.toHexString(),
    idpId: doc.idpId,
    email: doc.email,
    name: doc.name,
    idpRoles: doc.idpRoles,
    appRoles,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
    lastLoginAt: doc.lastLoginAt?.toISOString(),
    createdManually: doc.createdManually || false,
  });
};

export const save = async (user) => {
  const userDocument = new UserDocument(user);

  let result;

  try {
    result = await db.collection(collection).insertOne(userDocument);
  } catch (error) {
    if (error.code === 11000) {
      throw Boom.conflict(`User with the same idpId already exists`);
    }
    throw error;
  }

  if (!result.acknowledged) {
    throw Boom.internal(
      `User could not be created, the operation was not acknowledged`,
    );
  }
};

export const update = async (user) => {
  const userDocument = new UserDocument(user);

  const result = await db
    .collection(collection)
    .updateOne({ _id: userDocument._id }, { $set: userDocument });

  if (result.matchedCount === 0) {
    throw Boom.notFound(`User with id ${user.id} not found`);
  }

  if (!result.acknowledged) {
    throw Boom.internal(
      `User could not be updated, the operation was not acknowledged`,
    );
  }
};

export const findAll = async (query = {}) => {
  const filter = createFilter(query);

  const userDocuments = await db.collection(collection).find(filter).toArray();

  return userDocuments.map(toUser);
};

// eslint-disable-next-line complexity
const createFilter = (query) => {
  const filter = {
    // Exclude users without valid names (null, undefined, empty, or "placeholder")
    // We seem to have some users with a name of "placeholder" in the database, so we need to exclude them.
    // TODO: Remove this once we have a proper solution for this.
    name: {
      $exists: true,
      $nin: [null, ""],
      $not: { $regex: /^placeholder$/i },
    },
  };

  if (query.idpId) {
    filter.idpId = query.idpId;
  }

  if (query.allAppRoles?.length) {
    filter.$and = query.allAppRoles.map((role) => ({
      [`appRoles.${role}`]: { $exists: true },
    }));
  }

  if (query.anyAppRoles?.length) {
    filter.$or = query.anyAppRoles.map((role) => ({
      [`appRoles.${role}`]: { $exists: true },
    }));
  }

  if (query.ids?.length) {
    filter._id = {
      $in: query.ids.map((id) => ObjectId.createFromHexString(id)),
    };
  }

  return filter;
};

export const findById = async (userId) => {
  const userDocument = await db.collection(collection).findOne({
    _id: ObjectId.createFromHexString(userId),
  });

  return userDocument && toUser(userDocument);
};

/**
 * Logic Flow for User Login Upsert (after ticket FGP-903: Manual account lnking):
 *
 * 1. RETURNING USER: Try updating by 'idpId' first.
 *    - If found, this is a standard returning user (most common path).
 *    - Update their login fields and return immediately.
 *
 * 2. FIRST-TIME LOGIN (Manual Account Linking):
 *    - If no 'idpId' match, check if a user with this email exists AND was 'createdManually'.
 *    - If found, link this Entra ID identity to the existing manual account.
 *    - Update 'idpId', set 'createdManually' to false, and return.
 *
 * 3. NEW USER REGISTRATION:
 *    - If no 'idpId' match and no manual account match, create a brand new user.
 *    - Use 'upsert: true'.
 */

export const upsertLogin = async (user) => {
  const userDocument = new UserDocument(user);

  const loginFields = {
    idpRoles: userDocument.idpRoles,
    name: userDocument.name,
    email: userDocument.email,
    updatedAt: userDocument.updatedAt,
    lastLoginAt: userDocument.lastLoginAt,
  };

  // Try to update existing user by idpId (most common case - returning user - keeps it simple)
  const existingUser = await db
    .collection(collection)
    .findOneAndUpdate(
      { idpId: userDocument.idpId },
      { $set: loginFields },
      { returnDocument: "after" },
    );

  if (existingUser) {
    return toUser(existingUser);
  }

  return firstTimeLogin(userDocument, loginFields);
};

const firstTimeLogin = async (userDocument, loginFields) => {
  // First-time login - check if this email has a manually-created user
  // This handles the case where admin created a user before they logged in via Entra ID
  const manualUser = await db.collection(collection).findOne({
    email: { $regex: new RegExp(`^${userDocument.email}$`, "i") },
    createdManually: true,
  });

  if (manualUser) {
    return linkManualUser(manualUser, userDocument, loginFields);
  }

  // Create new user (or final fallback upsert)
  const result = await db.collection(collection).findOneAndUpdate(
    { idpId: userDocument.idpId },
    {
      $set: loginFields,
      $setOnInsert: {
        createdAt: userDocument.createdAt,
        appRoles: userDocument.appRoles,
      },
    },
    {
      upsert: true,
      returnDocument: "after",
    },
  );

  if (!result) {
    throw Boom.internal("User could not be created or updated");
  }

  return toUser(result);
};

const linkManualUser = async (manualUser, userDocument, loginFields) => {
  // Link the manually-created user to the Entra ID by updating their idpId
  const result = await db.collection(collection).findOneAndUpdate(
    { _id: manualUser._id },
    {
      $set: {
        ...loginFields,
        idpId: userDocument.idpId,
        createdManually: false, // No longer manually created
      },
    },
    { returnDocument: "after" },
  );

  if (!result) {
    throw Boom.internal("User could not be updated");
  }

  return toUser(result);
};

export const findByEmail = async (email) => {
  const userDocument = await db.collection(collection).findOne({
    email: { $regex: new RegExp(`^${email}$`, "i") },
  });

  return userDocument && toUser(userDocument);
};
