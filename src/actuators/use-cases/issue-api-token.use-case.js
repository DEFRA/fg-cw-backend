import { ApiClient } from "../../clients/models/api-client.js";
import {
  findByClient,
  insertToken,
} from "../../clients/repositories/access-token.repository.js";
import { auditActions } from "../../common/audit-constants.js";
import { withAudit } from "../../common/with-audit.js";
import { withTransaction } from "../../common/with-transaction.js";
import { loggedAction } from "../../common/logged-action.js";
import { buildApiClientAudit } from "./api-client-audit.js";
import { toApiTokenView } from "./list-api-clients.use-case.js";

const issueApiToken = (
  { clientId, tokenHash, tokenHint, expiresAt, newClient, confirmed, operator },
  session,
) =>
  loggedAction(
    `Issuing a token to API client "${clientId}" for ${operator.name}`,
    async () => {
      const now = new Date();
      const client = ApiClient.fromTokens(
        clientId,
        await findByClient(clientId, session),
      );
      const issued = client.issueToken({
        tokenHash,
        tokenHint,
        expiresAt,
        newClient,
        confirmed,
        by: operator.name,
        now,
      });

      await insertToken(
        { token: issued.token, hash: issued.tokenHash },
        session,
      );

      return {
        token: toApiTokenView(issued.token, { callerTokenId: null, now }),
        newClient: issued.newClient,
      };
    },
  );

export const issueApiTokenAuditBuilder = (
  [{ clientId, newClient, operator, caller }],
  result,
  error,
) =>
  buildApiClientAudit(
    {
      action: auditActions.ISSUE_API_TOKEN,
      clientId,
      tokenId: result?.token.tokenId,
      newClient: result?.newClient ?? newClient,
      operator,
      caller,
    },
    error,
  );

export const issueApiTokenUseCase = (command) =>
  withTransaction((session) =>
    withAudit(issueApiToken, issueApiTokenAuditBuilder)(command, session),
  );
