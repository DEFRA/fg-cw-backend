import crypto from "node:crypto";

export const hashToken = (raw) =>
  crypto.createHash("sha256").update(raw, "utf8").digest("hex");
