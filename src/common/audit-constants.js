export const auditEntities = {
  USER: "USER",
  ROLE: "ROLE",
  CASE: "CASE",
  WORKFLOW: "WORKFLOW",
  // One inbox/outbox row. Named for the thing acted on, as the others are.
  EVENT: "EVENT",
  // One list the grants admin surface can show, as this service declares it.
  BUCKET: "BUCKET",
  // A caller of this service's public API: the token rows sharing one name.
  API_CLIENT: "API_CLIENT",
};

export const auditActions = {
  LOGIN: "LOGIN",
  CREATE_USER: "CREATE_USER",
  UPDATE_USER: "UPDATE_USER",
  CREATE_ROLE: "CREATE_ROLE",
  UPDATE_ROLE: "UPDATE_ROLE",
  VIEW_CASE_LIST: "VIEW_CASE_LIST",
  VIEW_CASE_TYPE_LIST: "VIEW_CASE_TYPE_LIST",
  VIEW_CASE: "VIEW_CASE",
  VIEW_CASE_TAB: "VIEW_CASE_TAB",
  VIEW_LANDING_PAGE: "VIEW_LANDING_PAGE",
  VIEW_USER_LIST: "VIEW_USER_LIST",
  VIEW_USER_DETAILS: "VIEW_USER_DETAILS",
  CREATE_CASE: "CREATE_CASE",
  UPDATE_STAGE_OUTCOME: "UPDATE_STAGE_OUTCOME",
  UPDATE_TASK_STATUS: "UPDATE_TASK_STATUS",
  PERFORM_PAGE_ACTION: "PERFORM_PAGE_ACTION",
  ADD_NOTE_TO_CASE: "ADD_NOTE_TO_CASE",
  ASSIGN_USER_TO_CASE: "ASSIGN_USER_TO_CASE",
  // Workflows posted directly, before config versions. Stored audit rows
  // carry it.
  CREATE_WORKFLOW: "CREATE_WORKFLOW",
  // Putting one DEAD_LETTER row back in front of the poller. Requested by the
  // grants admin surface through fg-gas-backend, carried out here.
  REDRIVE_EVENT: "REDRIVE_EVENT",
  // Setting one DEAD_LETTER row aside for good: it becomes PURGED and is
  // deleted after the retention period. Requested the same way a redrive is.
  PURGE_EVENT: "PURGE_EVENT",
  // Replacing one DEAD_LETTER or PURGED row's payload, leaving its status
  // alone. Requested the same way a redrive is.
  EDIT_EVENT_PAYLOAD: "EDIT_EVENT_PAYLOAD",
  // The grants admin surface's case list before buckets. Stored audit rows
  // carry it.
  FIND_CASES: "FIND_CASES",
  // Reading one case for the same operator, whole document or summary.
  VIEW_CASE_DATA: "VIEW_CASE_DATA",
  // One page of one audited bucket, for the same operator.
  QUERY_BUCKET: "QUERY_BUCKET",
  // Storing one config version's workflow from S3, leaving the version's
  // record alone. Requested the same way a redrive is.
  FETCH_CONFIG_DEFINITION: "FETCH_CONFIG_DEFINITION",
  // Reading one API client's tokens, or one of them, for the grants admin.
  VIEW_API_CLIENT: "VIEW_API_CLIENT",
  // Issuing an API client a token, creating the client with its first.
  ISSUE_API_TOKEN: "ISSUE_API_TOKEN",
  REVOKE_API_TOKEN: "REVOKE_API_TOKEN",
  // Setting a token's expiry, reviving it if it was revoked.
  CHANGE_API_TOKEN_EXPIRY: "CHANGE_API_TOKEN_EXPIRY",
  // Replacing a token with a new one, the old kept for an overlap.
  ROTATE_API_TOKEN: "ROTATE_API_TOKEN",
  // Removing one token that is not active, for good.
  DELETE_API_TOKEN: "DELETE_API_TOKEN",
};

// The FCP audit event schema version, not the service's release version.
export const AUDIT_SCHEMA_VERSION = "1.0.0";

// The GIO application code, confirmed by the audit team.
export const AUDIT_APPLICATION = "Grants";

// Entra object ids are recorded as `AAD/<id>`.
export const AAD_USER_PREFIX = "AAD/";

// CDP environments are published as `cdp-<env>`; a local run is `local`.
export const LOCAL_ENVIRONMENT = "local";
export const CDP_ENVIRONMENT_PREFIX = "cdp-";

export const auditStatus = {
  SUCCESS: "success",
  FAILURE: "failure",
};

// Defra Protective Monitoring event reference codes (BUJ QRG v2.2), dashes stripped.
const pmcCodesByAction = {
  [auditActions.LOGIN]: "0701", // session created
  [auditActions.CREATE_USER]: "1204", // user registration / service enrollment
  [auditActions.UPDATE_USER]: "0704", // user role change / privilege uplift
  [auditActions.CREATE_ROLE]: "0705", // account permission & privilege management
  [auditActions.UPDATE_ROLE]: "0705", // account permission & privilege management
  [auditActions.VIEW_CASE_LIST]: "0706", // any action an internal/external user or service can execute
  [auditActions.VIEW_CASE_TYPE_LIST]: "0706", // any action an internal/external user or service can execute
  [auditActions.VIEW_CASE]: "0706", // any action an internal/external user or service can execute
  [auditActions.VIEW_CASE_TAB]: "0706", // any action an internal/external user or service can execute
  [auditActions.VIEW_LANDING_PAGE]: "0706", // any action an internal/external user or service can execute
  [auditActions.VIEW_USER_LIST]: "0706", // any action an internal/external user or service can execute
  [auditActions.VIEW_USER_DETAILS]: "0706", // any action an internal/external user or service can execute
  [auditActions.CREATE_CASE]: "0706", // any action an internal/external user or service can execute
  [auditActions.UPDATE_STAGE_OUTCOME]: "0706", // any action an internal/external user or service can execute
  [auditActions.UPDATE_TASK_STATUS]: "0706", // any action an internal/external user or service can execute
  [auditActions.PERFORM_PAGE_ACTION]: "0706", // any action an internal/external user or service can execute
  [auditActions.ADD_NOTE_TO_CASE]: "0706", // any action an internal/external user or service can execute
  [auditActions.ASSIGN_USER_TO_CASE]: "0706", // any action an internal/external user or service can execute
  [auditActions.CREATE_WORKFLOW]: "0706", // any action an internal/external user or service can execute
  [auditActions.REDRIVE_EVENT]: "0706", // any action an internal/external user or service can execute
  [auditActions.PURGE_EVENT]: "0706", // any action an internal/external user or service can execute
  [auditActions.EDIT_EVENT_PAYLOAD]: "0706", // any action an internal/external user or service can execute
  [auditActions.FIND_CASES]: "0706", // any action an internal/external user or service can execute
  [auditActions.VIEW_CASE_DATA]: "0706", // any action an internal/external user or service can execute
  [auditActions.QUERY_BUCKET]: "0706", // any action an internal/external user or service can execute
  [auditActions.FETCH_CONFIG_DEFINITION]: "0706", // any action an internal/external user or service can execute
  [auditActions.VIEW_API_CLIENT]: "0706", // any action an internal/external user or service can execute
  [auditActions.ISSUE_API_TOKEN]: "0705", // account permission & privilege management
  [auditActions.REVOKE_API_TOKEN]: "0705", // account permission & privilege management
  [auditActions.CHANGE_API_TOKEN_EXPIRY]: "0705", // account permission & privilege management
  [auditActions.ROTATE_API_TOKEN]: "0705", // account permission & privilege management
  [auditActions.DELETE_API_TOKEN]: "0705", // account permission & privilege management
};

export const buildAuditSecurity = (action) => ({
  pmccode: pmcCodesByAction[action],
});
