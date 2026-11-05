import { ApiClient } from "../../clients/models/api-client.js";
import { insertToken } from "../../clients/repositories/access-token.repository.js";
import { auditActions } from "../../common/audit-constants.js";
import { loggedAction } from "../../common/logged-action.js";
import { withAudit } from "../../common/with-audit.js";
import { withTransaction } from "../../common/with-transaction.js";
import { buildApiClientAudit } from "./api-client-audit.js";
import { toApiTokenView } from "./list-api-clients.use-case.js";
import {
  findManagedToken,
  saveTokenChange,
} from "./revoke-api-token.use-case.js";

const isoOf = (value) => (value instanceof Date ? value.toISOString() : null);

// The new token takes over the old one's expiry; the old one keeps working
// only for the overlap. Both writes commit together or not at all.
const rotateApiToken = (
  { clientId, tokenId, tokenHash, tokenHint, keepOld, callerTokenId, operator },
  session,
) =>
  loggedAction(
    `Rotating token "${tokenId}" of API client "${clientId}" for ${operator.name}`,
    async () => {
      const now = new Date();
      const old = await findManagedToken(clientId, tokenId, session);
      const { expiresAt } = old;
      const { asRead, changes } = old.rotate({ keepOld, now, callerTokenId });
      const issued = ApiClient.fromTokens(clientId, [old]).issueToken({
        tokenHash,
        tokenHint,
        expiresAt,
        newClient: false,
        by: operator.name,
        now,
      });

      await saveTokenChange({ clientId, tokenId, asRead, changes }, session);
      await insertToken(
        { token: issued.token, hash: issued.tokenHash },
        session,
      );

      return {
        token: toApiTokenView(issued.token, { callerTokenId, now }),
        oldExpiresAt: isoOf(changes.expiresAt),
      };
    },
  );

// A refused rotation inserted no token and left the old one as it was.
const rotationOutcome = (result) =>
  result
    ? { newTokenId: result.token.tokenId, oldExpiresAt: result.oldExpiresAt }
    : { newTokenId: null, oldExpiresAt: null };

export const rotateApiTokenAuditBuilder = (
  [{ clientId, tokenId, keepOld, operator, caller }],
  result,
  error,
) =>
  buildApiClientAudit(
    {
      action: auditActions.ROTATE_API_TOKEN,
      clientId,
      tokenId,
      extra: {
        rotation: { ...rotationOutcome(result), keepOld },
      },
      operator,
      caller,
    },
    error,
  );

export const rotateApiTokenUseCase = (command) =>
  withTransaction((session) =>
    withAudit(rotateApiToken, rotateApiTokenAuditBuilder)(command, session),
  );
