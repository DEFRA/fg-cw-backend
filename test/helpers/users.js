import { wreck } from "./wreck.js";

export const createUser = async (payload = {}) => {
  const response = await wreck.post("/users", {
    payload: {
      idpId: "abcd1234-5678-90ab-cdef-1234567890ab",
      name: "Name",
      email: "name.surname@defra.gov.uk",
      idpRoles: ["defra-idp"],
      appRoles: {
        ROLE_1: {
          startDate: "2025-07-01T00:00:00.000Z",
          endDate: "2025-08-02T00:00:00.000Z",
        },
        ROLE_2: {
          startDate: "2025-07-01T00:00:00.000Z",
          endDate: "2025-08-02T00:00:00.000Z",
        },
        ROLE_3: {
          startDate: "2025-07-01T00:00:00.000Z",
          endDate: "2025-08-02T00:00:00.000Z",
        },
      },
      ...payload,
    },
  });

  return response;
};
