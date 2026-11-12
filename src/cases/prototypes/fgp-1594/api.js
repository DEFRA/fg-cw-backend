// THROWAWAY standalone route contract. Never registered by src/main.js.
import Hapi from "@hapi/hapi";
import { labelFor, labelOptions } from "./logic.js";

export const createApi = (config, store, users) => {
  const server = Hapi.server();
  const base = "/case-types/{caseType}/pages/{pageKey}";
  const wrap = (handler) => async (request, h) => {
    if (
      request.params.caseType !== config.caseType ||
      request.params.pageKey !== config.pageKey
    )
      return h.response({ message: "Page not found" }).code(404);
    try {
      return await handler(request, h);
    } catch (error) {
      return h.response({ message: error.message }).code(400);
    }
  };
  server.route({
    method: "GET",
    path: base,
    handler: wrap(async () => {
      const rows = await store.rows(true);
      const completed = rows.filter(
        (row) => row.status.tag === "COMPLETED",
      ).length;
      return {
        pageType: "dedupe",
        heading: `${completed} of ${rows.length} issues completed`,
        completed,
        total: rows.length,
        rows: rows.map(
          ({ key, keyHash, details, assignee, status, columns }) => ({
            key,
            keyHash,
            details,
            assignee,
            status,
            columns,
          }),
        ),
      };
    }),
  });
  server.route({
    method: "GET",
    path: `${base}/groups/{keyHash}`,
    handler: wrap(async (request, h) => {
      const row = (await store.rows(false)).find(
        (item) => item.keyHash === request.params.keyHash,
      );
      if (!row) return h.response({ message: "Group not found" }).code(404);
      return {
        keyHash: row.keyHash,
        details: row.details,
        owner: row.owner,
        users,
        cases: row.cases.map((kase) => ({
          caseRef: kase.caseRef,
          status: kase.currentStatus,
          excluded: !row.activeCases.includes(kase),
          label: labelFor(kase, config),
          options: labelOptions(row, kase, config),
        })),
      };
    }),
  });
  server.route({
    method: "PUT",
    path: `${base}/groups/{keyHash}`,
    handler: wrap(async (request) =>
      store.save(request.params.keyHash, request.payload),
    ),
  });
  return server;
};
