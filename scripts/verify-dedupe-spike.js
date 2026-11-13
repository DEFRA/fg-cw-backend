// Cross-repository check: real frontend templates/form -> HTTP -> backend -> Mongo.
// Only Entra/session authentication is replaced with the seeded test user.
import Hapi from "@hapi/hapi";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import unitConfig from "../vitest.config.js";

assert.ok(
  process.env.FGP1594_FRONTEND,
  "Set FGP1594_FRONTEND to the frontend spike checkout",
);
const frontendRoot = resolve(process.env.FGP1594_FRONTEND);
for (const [key, value] of Object.entries(unitConfig.test.env))
  process.env[key] ??= String(value);
process.env.MONGO_URI =
  process.env.SPIKE_MONGO_URI ??
  "mongodb://127.0.0.1:27017/?directConnection=true";
process.env.MONGO_DATABASE = `fgp1594-spike-e2e-${randomUUID().slice(0, 8)}`;
process.env.NODE_ENV = "test";
const { db, mongoClient } = await import("../src/common/mongo-client.js");
const { dedupePageRoutes } =
  await import("../src/cases/routes/dedupe-page.route.js");
const { findCasesRoute } =
  await import("../src/cases/routes/find-cases.route.js");
const { findCaseByIdRoute } =
  await import("../src/cases/routes/find-case-by-id.route.js");
const { requestContext } = await import("../src/common/request-context.js");
const { setAuditActor } = await import("../src/common/set-audit-actor.js");
const { seedDedupe } = await import("../test/helpers/dedupe-seed.js");
const backend = Hapi.server({ host: "127.0.0.1", port: 0 });
let frontend;
const originalCwd = process.cwd();
try {
  const seed = await seedDedupe();
  await backend.register(requestContext);
  backend.auth.scheme("spike-user", () => ({
    authenticate: (_request, h) =>
      h.authenticated({ credentials: { user: seed.user } }),
  }));
  backend.auth.strategy("spike-user", "spike-user");
  backend.auth.default("spike-user");
  backend.ext("onPostAuth", setAuditActor);
  backend.route([...dedupePageRoutes, findCasesRoute, findCaseByIdRoute]);
  await backend.start();
  process.env.FG_CW_BACKEND = backend.info.uri;
  process.env.SESSION_COOKIE_PASSWORD =
    "the-password-must-be-at-least-32-characters-long";
  process.env.AUTH_COOKIE_PASSWORD = process.env.SESSION_COOKIE_PASSWORD;
  process.env.OIDC_CLIENT_ID = "client1";
  process.env.SESSION_CACHE_ENGINE = "memory";
  process.chdir(frontendRoot);
  const fromFrontend = (path) =>
    import(pathToFileURL(resolve(frontendRoot, path)));
  const { nunjucks } = await fromFrontend("src/common/nunjucks/nunjucks.js");
  const { cases } = await fromFrontend("src/cases/index.js");
  const requireFrontend = createRequire(resolve(frontendRoot, "package.json"));
  const { load } = await import(
    pathToFileURL(requireFrontend.resolve("cheerio"))
  );
  frontend = Hapi.server();
  frontend.auth.scheme("spike-session", () => ({
    authenticate: (_request, h) =>
      h.authenticated({
        credentials: { token: "spike-test-user", user: seed.user },
      }),
  }));
  frontend.auth.strategy("session", "spike-session");
  frontend.auth.default("session");
  frontend.ext("onPreHandler", (request, h) => {
    request.yar = { flash: () => [] };
    return h.continue;
  });
  await frontend.register([nunjucks, cases]);
  const request = async (method, url, payload, status = 200) => {
    const response = await frontend.inject({
      method,
      url,
      payload,
      auth: {
        strategy: "session",
        credentials: { token: "spike-test-user", user: seed.user },
      },
    });
    assert.equal(response.statusCode, status, response.payload);
    return response;
  };
  const caseList = load((await request("GET", "/cases")).payload);
  const summaryHref = caseList("a")
    .toArray()
    .map((element) => caseList(element).attr("href"))
    .find((href) => href === "/types/frps-private-beta/pages/duplicates");
  assert.ok(
    summaryHref,
    "Configured tab is discoverable on the existing case list",
  );
  const summary = load((await request("GET", summaryHref)).payload);
  assert.ok(summary.text().includes("0 of 3 issues completed"));
  const groupHref = summary("a")
    .toArray()
    .map((element) => summary(element).attr("href"))
    .find((href) => href?.includes("/groups/"));
  const detail = load((await request("GET", groupHref)).payload);
  const controls = detail("select[name^='label-']:not([disabled])").toArray();
  assert.equal(controls.length, 2);
  const labels = Object.fromEntries(
    controls.map((element) => [
      detail(element).attr("name"),
      detail(element)
        .find("option")
        .toArray()
        .map((option) => detail(option))
        .find((option) => option.text().includes("Not duplicate"))
        .val(),
    ]),
  );
  const response = await request(
    "POST",
    groupHref,
    { assignee: seed.user.id, ...labels },
    302,
  );
  assert.equal(response.headers.location, summaryHref);
  const updated = load((await request("GET", summaryHref)).payload);
  assert.ok(updated.text().includes("1 of 3 issues completed"));
  const refs = controls.map((element) => detail(element).attr("name").slice(6));
  const stored = await db
    .collection("cases")
    .find({ caseRef: { $in: refs } })
    .toArray();
  assert.ok(stored.every((kase) => kase.labels[0].code === "NOT_DUPLICATE"));
  assert.ok(
    stored.every((kase) => kase.timeline[0].eventType === "CASE_LABEL_CHANGED"),
  );
  assert.equal(
    await db
      .collection("case_groups")
      .countDocuments({ "assignee.id": seed.user.id }),
    1,
  );
  const repeated = load((await request("GET", groupHref)).payload);
  assert.equal(repeated("#assignee option[selected]").val(), seed.user.id);
  assert.equal(
    repeated("select[name^='label-'] option[selected]").filter(
      (_index, option) => repeated(option).text() === "Not duplicate",
    ).length,
    2,
  );
  const timeline = load(
    (await request("GET", `/cases/${stored[0]._id.toHexString()}/timeline`))
      .payload,
  );
  assert.ok(timeline.text().includes("Case label changed"));
  assert.ok(timeline.text().includes("NOT_DUPLICATE"));
  process.stdout.write(
    "PASS existing case list tab -> configured summary -> group form -> frontend POST -> backend HTTP -> Mongo labels, timelines and owner -> reloaded HTML and actual case timeline\n",
  );
  process.stdout.write(
    "Authentication is a test substitute; Entra login is not exercised. Scratch database removed at exit.\n",
  );
} finally {
  process.chdir(originalCwd);
  await frontend?.stop();
  await backend.stop();
  await db.dropDatabase();
  await mongoClient.close();
}
