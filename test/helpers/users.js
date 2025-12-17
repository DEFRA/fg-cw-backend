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
