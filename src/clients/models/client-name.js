export const CLIENT_NAME_MAX = 64;

// A name of 64 hex characters reads as a hash, which no listing may carry.
export const CLIENT_NAME = /^(?![0-9a-f]{64}$)[a-z0-9-]+$/;

export const isClientName = (value) =>
  typeof value === "string" &&
  value.length <= CLIENT_NAME_MAX &&
  CLIENT_NAME.test(value);
