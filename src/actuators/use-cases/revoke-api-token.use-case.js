import {
  tokenNotActive,
  tokenNotFound,
} from "../../clients/models/access-token.js";
import {
  findTokenOfClient,
  saveTokenChanges,
} from "../../clients/repositories/access-token.repository.js";
import { auditActions } from "../../common/audit-constants.js";
import { loggedAction } from "../../common/logged-action.js";
import { withAudit } from "../../common/with-audit.js";
import { withTransaction } from "../../common/with-transaction.js";
import { buildApiClientAudit } from "./api-client-audit.js";

// A row whose stored name fails the name rule has no client, so it is never
// found under that stored name either.
export const findManagedToken = async (clientId, tokenId, session) => {
  const token = await findTokenOfClient(clientId, tokenId, session);

  if (token?.clientId !== clientId) {
    throw tokenNotFound(tokenId);
  }

  return token;
};

// Saves a change onto the row as it was read, or refuses: a row that changed
// meanwhile matches nothing, and throwing aborts the transaction.
export const saveTokenChange = async (
  { clientId, tokenId, asRead, changes },
  session,
) => {
  if (
    !(await saveTokenChanges({ clientId, tokenId, asRead, changes }, session))
  ) {
    throw tokenNotActive(tokenId);
  }
};

// The request's own token is never revoked, so neither GPA on fg-gas-backend
// nor fg-gas-backend here can lock itself out.
const revokeApiToken = (
  { clientId, tokenId, callerTokenId, operator },
  session,
) =>
  loggedAction(
    `Revoking token "${tokenId}" of API client "${clientId}" for ${operator.name}`,
    async () => {
      const token = await findManagedToken(clientId, tokenId, session);
      const { asRead, changes } = token.revoke({
        by: operator.name,
        now: new Date(),
        callerTokenId,
      });

      await saveTokenChange({ clientId, tokenId, asRead, changes }, session);
    },
  );

export const revokeApiTokenAuditBuilder = (
  [{ clientId, tokenId, operator, caller }],
  _result,
  error,
) =>
  buildApiClientAudit(
    {
      action: auditActions.REVOKE_API_TOKEN,
      clientId,
      tokenId,
      operator,
      caller,
    },
    error,
  );

export const revokeApiTokenUseCase = (command) =>
  withTransaction((session) =>
    withAudit(revokeApiToken, revokeApiTokenAuditBuilder)(command, session),
  );
