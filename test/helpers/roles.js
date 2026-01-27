import { randomUUID } from "node:crypto";

import { wreck } from "./wreck.js";

export const createRole = async (payload = {}) => {
  return await wreck.post("/roles", {
    payload: {
      code: `TEST_ROLE_${randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase()}`,
      description: "Test role",
      assignable: true,
      ...payload,
    },
  });
};
