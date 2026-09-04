import { findPage } from "../../cases/repositories/outbox.repository.js";
import { config } from "../../common/config.js";

const MAX_ATTEMPTS = parseInt(config.get("outbox.outboxMaxRetries"));

export const findOutboxPageUseCase = async ({
  cursor,
  direction,
  pageSize,
  status,
  q,
  from,
  to,
}) => {
  const page = await findPage({
    cursor,
    direction,
    pageSize,
    status,
    q,
    from,
    to,
  });

  return {
    ...page,
    data: page.data.map((row) => ({ ...row, maxAttempts: MAX_ATTEMPTS })),
  };
};
