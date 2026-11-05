import {
  auditEntities,
  buildAuditSecurity,
} from "../../common/audit-constants.js";
import { buildOperatorSecurityContext } from "../../common/audit-security-context.js";

const errorCodeOf = (error) =>
  error?.isBoom ? (error.output.payload.errorCode ?? null) : null;

// Named fields only, never the arguments spread: an issue's or a rotation's
// carry the token's hash, which may not reach an audit record. `extra` is what
// one action adds, built from named fields by its own builder. Nor may an error's message, which
// a duplicate key fills with the hash.
export const buildApiClientAudit = (
  {
    action,
    clientId,
    tokenId = null,
    newClient = null,
    extra = {},
    operator,
    caller,
  },
  error,
) => ({
  entities: [{ entity: auditEntities.API_CLIENT, action, entityid: clientId }],
  details: {
    security: buildOperatorSecurityContext(operator),
    client: {
      tokenId,
      newClient,
      caller,
      actor: operator.name,
      errorCode: errorCodeOf(error),
      ...extra,
    },
  },
  security: buildAuditSecurity(action),
  segregationRef: `api-client-${clientId}`,
});
