import { config } from "../src/common/config.js";

export const up = async (db) => {
  const environment = config.get("cdpEnvironment");

  // Only remove placeholder users in non-production environments
  if (environment === "production") {
    return;
  }

  const users = db.collection("users");
  await users.deleteMany({ name: "placeholder" });
};
