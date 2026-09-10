import { findPage } from "../repositories/outbox.repository.js";
import { config } from "../../common/config.js";
import { OutboxEventRow } from "./event-rows.js";

const DECIMAL = 10;
const MAX_ATTEMPTS = Number.parseInt(
  config.get("outbox.outboxMaxRetries"),
  DECIMAL,
);

export const findOutboxPageUseCase = async ({
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
    data: page.data.map((doc) => ({
      ...OutboxEventRow.fromOutbox(doc),
      maxAttempts: MAX_ATTEMPTS,
    })),
  };
};
