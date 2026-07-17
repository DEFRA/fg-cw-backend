import { AsyncLocalStorage } from "node:async_hooks";

const asyncLocalStorage = new AsyncLocalStorage();

export const getRequestContext = () => asyncLocalStorage.getStore() ?? null;

const wrapCycle = (request, cycle, store) => {
  const requestCycle = request[cycle].bind(request);
  request[cycle] = () => asyncLocalStorage.run(store, requestCycle);
};

export const requestContext = {
  plugin: {
    name: "request-context",
    once: true,
    register(server) {
      server.ext("onRequest", (request, h) => {
        const store = { ip: request.info.remoteAddress };
        wrapCycle(request, "_lifecycle", store);
        wrapCycle(request, "_postCycle", store);
        return h.continue;
      });
    },
  },
};
