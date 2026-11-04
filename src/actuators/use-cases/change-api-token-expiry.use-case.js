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

const changeApiTokenExpiry = (
  { clientId, tokenId, expiresAt, callerTokenId, operator },
  session,
) =>
  loggedAction(
    `Changing the expiry of token "${tokenId}" of API client "${clientId}" for ${operator.name}`,
    async () => {
      const now = new Date();
      const token = await findManagedToken(clientId, tokenId, session);
      const { asRead, changes, revived } = token.changeExpiry({
        expiresAt,
        now,
        callerTokenId,
      });

      await saveTokenChange({ clientId, tokenId, asRead, changes }, session);

      return {
        token: toApiTokenView(token, { callerTokenId, now }),
        previousExpiresAt: isoOf(asRead.expiresAt),
        revived,
      };
    },
  );

// A refused change changed nothing, so there was no previous expiry to keep.
const expiryOutcome = (result) =>
  result
    ? { previous: result.previousExpiresAt, revived: result.revived }
    : { previous: null, revived: false };

export const changeApiTokenExpiryAuditBuilder = (
  [{ clientId, tokenId, expiresAt, operator, caller }],
  result,
  error,
) =>
  buildApiClientAudit(
    {
      action: auditActions.CHANGE_API_TOKEN_EXPIRY,
      clientId,
      tokenId,
      extra: {
        expiry: { ...expiryOutcome(result), next: isoOf(expiresAt) },
      },
      operator,
      caller,
    },
    error,
  );

export const changeApiTokenExpiryUseCase = (command) =>
  withTransaction((session) =>
    withAudit(changeApiTokenExpiry, changeApiTokenExpiryAuditBuilder)(
      command,
      session,
    ),
  );
