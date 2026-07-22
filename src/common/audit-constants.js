export const auditEntities = {
  USER: "USER",
  ROLE: "ROLE",
  CASE: "CASE",
};

export const auditActions = {
  LOGIN: "LOGIN",
  CREATE_USER: "CREATE_USER",
  UPDATE_USER: "UPDATE_USER",
  CREATE_ROLE: "CREATE_ROLE",
  UPDATE_ROLE: "UPDATE_ROLE",
  VIEW_CASE_LIST: "VIEW_CASE_LIST",
  VIEW_ROLE_LIST: "VIEW_ROLE_LIST",
};

export const auditStatus = {
  SUCCESS: "SUCCESS",
  FAILURE: "FAILURE",
};

// Defra Protective Monitoring event reference codes (BUJ QRG v2.2), dashes stripped.
const pmcCodesByAction = {
  [auditActions.LOGIN]: "0701", // session created
  [auditActions.CREATE_USER]: "1204", // user registration / service enrollment
  [auditActions.UPDATE_USER]: "0704", // user role change / privilege uplift
  [auditActions.CREATE_ROLE]: "0705", // account permission & privilege management
  [auditActions.UPDATE_ROLE]: "0705", // account permission & privilege management
  [auditActions.VIEW_CASE_LIST]: "0706", // any action an internal/external user or service can execute
  [auditActions.VIEW_ROLE_LIST]: "0706", // any action an internal/external user or service can execute
};

export const buildAuditSecurity = (action) => ({
  pmccode: pmcCodesByAction[action],
});
