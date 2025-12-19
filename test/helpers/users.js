import { IdpRoles } from "../../src/users/models/idp-roles.js";
import { wreck } from "./wreck.js";

export const createUser = async (payload = {}) => {
  const response = await wreck.post("/users", {
    payload: {
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
      ...payload,
    },
  });

  return response;
};

export const createAdminUser = async (payload = {}) => {
  return createUser({
    idpId: "9f6b80d3-99d3-42dc-ac42-b184595b1ef1",
    name: "Test Admin",
    email: "admin@t.gov.uk",
    idpRoles: [IdpRoles.Admin],
    ...payload,
  });
};

export const createReadOnlyUser = async (payload = {}) => {
  return createUser({
    idpId: "8b7e28f3-44de-453a-a775-77d11ea9b9a3",
    name: "Test Reader",
    email: "reader@t.gov.uk",
    idpRoles: [IdpRoles.Read],
    ...payload,
  });
};

export const createReadWriteUser = async (payload = {}) => {
  return createUser({
    idpId: "df20f4bd-d009-4bf4-b499-46e93e0f005a",
    name: "Test ReaderWriter",
    email: "readerwriter@t.gov.uk",
    idpRoles: [IdpRoles.ReadWrite],
    ...payload,
  });
};

export const updateUser = async (userId, payload) => {
  return await wreck.patch(`/users/${userId}`, {
    payload,
  });
};
