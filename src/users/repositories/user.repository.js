import Boom from "@hapi/boom";
import { ObjectId } from "mongodb";
import { db } from "../../common/mongo-client.js";
import { UserDocument } from "../models/user-document.js";
import { User } from "../models/user.js";

const collection = "users";

const toUser = (doc) =>
  new User({
    id: doc._id.toHexString(),
    email: doc.email,
    firstName: doc.firstName,
    lastName: doc.lastName,
    roles: doc.roles,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  });

export const save = async (user) => {
  const userDocument = new UserDocument(user);

  let result;

  try {
    result = await db.collection(collection).insertOne(userDocument);
  } catch (error) {
    if (error.code === 11000) {
      throw Boom.conflict(`User with the same email already exists`);
    }
    throw error;
  }

  if (!result.acknowledged) {
    throw Boom.internal(
      `User could not be created, the operation was not acknowledged`,
    );
  }
};

export const update = async (userId, props) => {
  const result = await db
    .collection(collection)
    .updateOne({ _id: ObjectId.createFromHexString(userId) }, { $set: props });

  if (result.matchedCount === 0) {
    throw Boom.notFound(`User with id ${userId} not found`);
  }

  if (!result.acknowledged) {
    throw Boom.internal(
      `User could not be updated, the operation was not acknowledged`,
    );
  }
};

export const findAll = async () => {
  const userDocuments = await db.collection(collection).find().toArray();

  return userDocuments.map(toUser);
};

export const findById = async (userId) => {
  const userDocument = await db.collection(collection).findOne({
    _id: ObjectId.createFromHexString(userId),
  });

  return userDocument && toUser(userDocument);
};
