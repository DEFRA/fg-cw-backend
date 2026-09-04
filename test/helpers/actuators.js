import { SERVICE_TOKEN } from "./service-token.js";
import { wreck } from "./wreck.js";

const get = (path, query, token) =>
  wreck.get(query ? `${path}?${new URLSearchParams(query)}` : path, {
    headers: { authorization: token },
  });

export const findInbox = (query, token = `Bearer ${SERVICE_TOKEN}`) =>
  get("/actuators/inbox", query, token);

export const findOutbox = (query, token = `Bearer ${SERVICE_TOKEN}`) =>
  get("/actuators/outbox", query, token);

const post = (path, token, payload) =>
  wreck.post(path, {
    headers: { authorization: token },
    ...(payload ? { payload } : {}),
  });

// `by` travels as a query parameter on every mutation, never as a body key.
const withActor = (path, by) =>
  by ? `${path}?by=${encodeURIComponent(by)}` : path;

export const getInboxEvent = (id, token = `Bearer ${SERVICE_TOKEN}`) =>
  get(`/actuators/inbox/${id}`, undefined, token);

export const getOutboxEvent = (id, token = `Bearer ${SERVICE_TOKEN}`) =>
  get(`/actuators/outbox/${id}`, undefined, token);

export const redriveInboxEvent = (
  id,
  { by } = {},
  token = `Bearer ${SERVICE_TOKEN}`,
) => post(withActor(`/actuators/inbox/${id}/redrive`, by), token);

export const redriveOutboxEvent = (
  id,
  { by } = {},
  token = `Bearer ${SERVICE_TOKEN}`,
) => post(withActor(`/actuators/outbox/${id}/redrive`, by), token);

export const countInbox = (query, token = `Bearer ${SERVICE_TOKEN}`) =>
  get("/actuators/inbox/counts", query, token);

export const countOutbox = (query, token = `Bearer ${SERVICE_TOKEN}`) =>
  get("/actuators/outbox/counts", query, token);

export const breakdownInbox = (query, token = `Bearer ${SERVICE_TOKEN}`) =>
  get("/actuators/inbox/breakdown", query, token);

export const breakdownOutbox = (query, token = `Bearer ${SERVICE_TOKEN}`) =>
  get("/actuators/outbox/breakdown", query, token);
