import { findAll } from "../../clients/repositories/access-token.repository.js";
import { auditActions } from "../../common/audit-constants.js";
import { auditedRead } from "../../common/audited-read.js";
import { config } from "../../common/config.js";
import { buildApiClientAudit } from "./api-client-audit.js";

const isoOf = (value) => (value instanceof Date ? value.toISOString() : null);

// Every fact as stored, and the status the model derives from them now, for a
// page that groups and sorts them itself and never re-derives a status. The
// caller is told which row is its own token, so GPA can leave Revoke off it;
// the caller already holds that token, so this tells it nothing new.
export const toApiTokenView = (token, { callerTokenId, now }) => ({
  tokenId: token.tokenId,
  clientId: token.clientId,
  tokenHint: token.tokenHint,
  status: token.status(now),
  createdAt: isoOf(token.createdAt),
  createdBy: token.createdBy,
  expiresAt: isoOf(token.expiresAt),
  revokedAt: isoOf(token.revokedAt),
  revokedBy: token.revokedBy,
  inUse: token.isHeldBy(callerTokenId),
});

const listApiClients = async ({ callerTokenId }) => {
  const tokens = await findAll();
  const now = new Date();

  return {
    tokens: tokens.map(({ token, stored }) => ({
      ...toApiTokenView(token, { callerTokenId, now }),
      stored,
    })),
  };
};

// Every client's tokens are read at once, so the audit names this service.
export const listApiClientsAuditBuilder = (
  { operator, caller },
  _result,
  error,
) =>
  buildApiClientAudit(
    {
      action: auditActions.VIEW_API_CLIENT,
      clientId: config.get("serviceName"),
      operator,
      caller,
    },
    error,
  );

export const listApiClientsUseCase = auditedRead(
  listApiClients,
  listApiClientsAuditBuilder,
);
