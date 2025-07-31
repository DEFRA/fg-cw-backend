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
          startDate: "01/01/2025",
          endDate: "02/08/2025",
        },
        ROLE_2: {
          startDate: "01/01/2025",
          endDate: "02/08/2025",
        },
        ROLE_3: {
          startDate: "01/01/2025",
          endDate: "02/08/2025",
        },
      },
      ...payload,
    },
  });

  return response;
};
