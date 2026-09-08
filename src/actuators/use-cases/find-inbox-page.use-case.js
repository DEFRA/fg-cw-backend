import { findPage } from "../../cases/repositories/inbox.repository.js";
import { config } from "../../common/config.js";

const DECIMAL = 10;
const MAX_ATTEMPTS = Number.parseInt(
  config.get("inbox.inboxMaxRetries"),
  DECIMAL,
);

export const findInboxPageUseCase = async ({
  cursor,
  direction,
  pageSize,
  status,
  q,
  error,
  from,
  to,
  audit,
}) => {
  const page = await findPage({
    cursor,
    direction,
    pageSize,
    status,
    q,
    error,
    from,
    to,
    audit,
  });

  return {
    ...page,
    data: page.data.map((row) => ({ ...row, maxAttempts: MAX_ATTEMPTS })),
  };
};
