// The operator GAS forwards on an admin read, in every test that needs one.
export const OPERATOR_ID = "6f1c2e9a-1b2c-4d4e-8f6a-7b8c9d0e1f2a";
export const OPERATOR_NAME = "Jane Smith";

export const operatorHeaders = {
  "x-actor": OPERATOR_NAME,
  "x-actor-id": OPERATOR_ID,
};
