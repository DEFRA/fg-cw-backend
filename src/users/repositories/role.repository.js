import Boom from "@hapi/boom";
import { db } from "../../common/mongo-client.js";
import { RoleDocument } from "../models/role-document.js";
import { Role } from "../models/role.js";

const collection = "roles";

const toRole = (doc) =>
  new Role({
    id: doc._id.toHexString(),
    code: doc.code,
    description: doc.description,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  });

export const save = async (role) => {
  const roleDocument = new RoleDocument(role);

  let result;

  try {
    result = await db.collection(collection).insertOne(roleDocument);
  } catch (error) {
    if (error.code === 11000) {
      throw Boom.conflict(`Role with code ${role.code} already exists`);
    }
    throw error;
  }

  if (!result.acknowledged) {
    throw Boom.internal(
      `Role with code ${role.code} could not be created, the operation was not acknowledged`,
    );
  }
};

export const findAll = async () => {
  const roleDocuments = await db.collection(collection).find({}).toArray();

  return roleDocuments.map(toRole);
};

export const findByCode = async (code) => {
  const roleDocument = await db.collection(collection).findOne({
    code,
  });

  return roleDocument && toRole(roleDocument);
};
