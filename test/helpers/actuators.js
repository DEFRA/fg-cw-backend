import { hashToken } from "../../src/server/plugins/auth/hash-token.js";
import {
  CASE_READER_CLIENT,
  CASE_READER_TOKEN,
  SERVICE_TOKEN,
} from "./service-token.js";
import { wreck } from "./wreck.js";
import { operatorHeaders } from "./operator.js";

const get = (path, query, token) =>
  wreck.get(query ? `${path}?${new URLSearchParams(query)}` : path, {
    headers: { authorization: token },
  });

// Both boxes in one read: the call the admin surface makes, and since the six
// per-box endpoints were retired the only list call there is.
export const findPage = (query, token = `Bearer ${SERVICE_TOKEN}`) =>
  get("/actuators/events", query, token);

const post = (path, token, payload, headers = {}) =>
  wreck.post(path, {
    headers: { authorization: token, ...headers },
    ...(payload ? { payload } : {}),
  });

const withActor = (path, by) =>
  by ? `${path}?by=${encodeURIComponent(by)}` : path;

export const getInboxEvent = (id, token = `Bearer ${SERVICE_TOKEN}`) =>
  get(`/actuators/events/inbox/${id}`, undefined, token);

export const getOutboxEvent = (id, token = `Bearer ${SERVICE_TOKEN}`) =>
  get(`/actuators/events/outbox/${id}`, undefined, token);

export const redriveInboxEvent = (
  id,
  { by } = {},
  token = `Bearer ${SERVICE_TOKEN}`,
  headers = {},
) =>
  wreck.post(withActor(`/actuators/events/inbox/${id}/redrive`, by), {
    headers: { authorization: token, ...headers },
  });

export const redriveOutboxEvent = (
  id,
  { by } = {},
  token = `Bearer ${SERVICE_TOKEN}`,
) => post(withActor(`/actuators/events/outbox/${id}/redrive`, by), token);

export const purgeInboxEvent = (
  id,
  { by, ...payload } = {},
  token = `Bearer ${SERVICE_TOKEN}`,
  headers = {},
) =>
  post(
    withActor(`/actuators/events/inbox/${id}/purge`, by),
    token,
    payload,
    headers,
  );

export const purgeOutboxEvent = (
  id,
  { by, ...payload } = {},
  token = `Bearer ${SERVICE_TOKEN}`,
) =>
  post(withActor(`/actuators/events/outbox/${id}/purge`, by), token, payload);

export const editInboxPayload = (
  id,
  { by, ...payload } = {},
  token = `Bearer ${SERVICE_TOKEN}`,
  headers = {},
) =>
  post(
    withActor(`/actuators/events/inbox/${id}/payload`, by),
    token,
    payload,
    headers,
  );

export const editOutboxPayload = (
  id,
  { by, ...payload } = {},
  token = `Bearer ${SERVICE_TOKEN}`,
) =>
  post(withActor(`/actuators/events/outbox/${id}/payload`, by), token, payload);

const asCaseReader = (headers) => ({
  authorization: `Bearer ${CASE_READER_TOKEN}`,
  ...operatorHeaders,
  ...headers,
});

export const seedCaseReaderToken = (db) =>
  db.collection("access_tokens").replaceOne(
    { client: CASE_READER_CLIENT },
    {
      id: hashToken(CASE_READER_TOKEN),
      client: CASE_READER_CLIENT,
      expiresAt: null,
    },
    { upsert: true },
  );

export const searchCases = (payload, headers = {}) =>
  wreck.post("/actuators/cases/search", {
    headers: asCaseReader(headers),
    payload,
  });

export const viewCaseData = (workflowCode, caseRef, query, headers = {}) =>
  wreck.get(
    `/actuators/cases/${workflowCode}/${caseRef}${query ? `?${new URLSearchParams(query)}` : ""}`,
    { headers: asCaseReader(headers) },
  );

export const caseExistence = (workflowCode, caseRef, headers = {}) =>
  wreck.get(`/actuators/cases/${workflowCode}/${caseRef}/existence`, {
    headers: asCaseReader(headers),
  });
