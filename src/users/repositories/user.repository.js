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
