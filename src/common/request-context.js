import { AsyncLocalStorage } from "node:async_hooks";

const asyncLocalStorage = new AsyncLocalStorage();

// The audit schema caps `ip` at 20 characters.
const MAX_IP_LENGTH = 20;

export const getRequestContext = () => asyncLocalStorage.getStore() ?? null;

const normaliseIp = (ip) => ip?.trim().replace(/^::ffff:/i, "") || undefined;

const fitsAuditSchema = (ip) => ip !== undefined && ip.length <= MAX_IP_LENGTH;

// The backend sits behind a local proxy, so `remoteAddress` is loopback. The
// originating client is the first `x-forwarded-for` entry, set by the
// platform ingress and passed on by fg-cw-frontend.
export const getClientIp = (request) => {
  const forwardedFor = request.headers?.["x-forwarded-for"]?.split(",")[0];

  return [normaliseIp(forwardedFor), normaliseIp(request.info.remoteAddress)]
    .filter(fitsAuditSchema)
    .at(0);
};

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
        const store = { ip: getClientIp(request) };
        wrapCycle(request, "_lifecycle", store);
        wrapCycle(request, "_postCycle", store);
        return h.continue;
      });
    },
  },
};
