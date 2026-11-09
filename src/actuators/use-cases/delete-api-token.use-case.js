import { tokenNotFound } from "../../clients/models/access-token.js";
import { deleteInactiveToken } from "../../clients/repositories/access-token.repository.js";
import { auditActions } from "../../common/audit-constants.js";
import { loggedAction } from "../../common/logged-action.js";
import { withAudit } from "../../common/with-audit.js";
import { withTransaction } from "../../common/with-transaction.js";
import { buildApiClientAudit } from "./api-client-audit.js";
import { findManagedToken } from "./revoke-api-token.use-case.js";

// Nothing matched: the token was revived or deleted meanwhile, so the refusal
// is whatever it is now.
const refusal = async (clientId, tokenId, now, session) => {
  const token = await findManagedToken(clientId, tokenId, session);

  token.assertDeletable(now);

  return tokenNotFound(tokenId);
};

const deleteApiToken = ({ clientId, tokenId, operator }, session) =>
  loggedAction(
    `Deleting token "${tokenId}" of API client "${clientId}" for ${operator.name}`,
    async () => {
      const now = new Date();

      (await findManagedToken(clientId, tokenId, session)).assertDeletable(now);

      if (!(await deleteInactiveToken({ clientId, tokenId, now }, session))) {
        throw await refusal(clientId, tokenId, now, session);
      }
    },
  );

export const deleteApiTokenAuditBuilder = (
  [{ clientId, tokenId, operator, caller }],
  _result,
  error,
) =>
  buildApiClientAudit(
    {
      action: auditActions.DELETE_API_TOKEN,
      clientId,
      tokenId,
      operator,
      caller,
    },
    error,
  );

export const deleteApiTokenUseCase = (command) =>
  withTransaction((session) =>
    withAudit(deleteApiToken, deleteApiTokenAuditBuilder)(command, session),
  );
