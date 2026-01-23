import Wreck from "@hapi/wreck";
import { MongoClient } from "mongodb";
import { env } from "node:process";
import { IdpRoles } from "../../src/users/models/idp-roles.js";
import { wreck } from "./wreck.js";

export const TestUser = {
  Admin: {
    idpId: "9f6b80d3-99d3-42dc-ac42-b184595b1ef1",
    name: "Test Admin",
    email: "admin@t.gov.uk",
    idpRoles: [IdpRoles.Admin],
  },
  ReadWrite: {
    idpId: "df20f4bd-d009-4bf4-b499-46e93e0f005a",
    name: "Test ReaderWriter",
    email: "readerwriter@t.gov.uk",
    idpRoles: [IdpRoles.ReadWrite],
  },
  ReadOnly: {
    idpId: "8b7e28f3-44de-453a-a775-77d11ea9b9a3",
    name: "Test Reader",
    email: "reader@t.gov.uk",
    idpRoles: [IdpRoles.Read],
  },
};

const defaultUserPayload = {
  idpId: "abcd1234-5678-90ab-cdef-1234567890ab",
  name: "Name",
  email: "name.surname@defra.gov.uk",
  idpRoles: ["FCP.Casework.ReadWrite"],
  appRoles: {
    ROLE_1: {
      startDate: "2025-07-01",
      endDate: "2100-01-01",
    },
    ROLE_2: {
      startDate: "2025-07-02",
      endDate: "2100-01-02",
    },
    ROLE_3: {
      startDate: "2025-07-03",
      endDate: "2100-01-03",
    },
  },
};

export const createUser = async (payload = {}) => {
  const response = await wreck.post(`/users/login`, {
    payload: { ...defaultUserPayload, ...payload },
  });

  return response.payload;
};

export const createAdminUser = async (payload = {}) => {
  const mergedPayload = {
    ...defaultUserPayload,
    ...TestUser.Admin,
    ...payload,
  };
  const user = await createUser(mergedPayload);

  await updateAppRoles(user, mergedPayload.appRoles);

  return { ...user, appRoles: mergedPayload.appRoles };
};

const updateAppRoles = async (user, appRoles) => {
  // Direct MongoDB update to force set appRoles, API does not allow admin to update their own appRoles
  const client = new MongoClient(env.MONGO_URI);
  try {
    await client.connect();
    const db = client.db();
    await db
      .collection("users")
      .updateOne({ idpId: user.idpId }, { $set: { appRoles } });
  } finally {
    await client.close();
  }
};

export const removeUserAppRoles = async (userId) => {
  return await changeUserAppRoles(userId, {});
};

export const changeUserAppRoles = async (userId, appRoles) => {
  return await wreck.patch(`/users/${userId}`, {
    payload: { appRoles },
  });
};

export const changeUserIdpRoles = async (user, idpRoles) => {
  const { idpId, name, email } = user;

  const response = await wreck.post("/users/login", {
    payload: { idpId, name, email, idpRoles },
  });

  return response;
};

export const getTokenFor = async (username) => {
  const tokenResponse = await Wreck.post(env.OIDC_SIGN_TOKEN_ENDPOINT, {
    json: true,
    payload: {
      clientId: "client1",
      username,
    },
  });

  return tokenResponse.payload.access_token;
};
