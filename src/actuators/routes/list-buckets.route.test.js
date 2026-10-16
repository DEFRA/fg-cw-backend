import { beforeEach, describe, expect, it, vi } from "vitest";
import { listBucketsUseCase } from "../use-cases/list-buckets.use-case.js";
import { serverFor } from "../../../test/helpers/case-route-server.js";
import { CASE_READER_CLIENT } from "../../common/require-case-reader.js";
import { listBucketsRoute } from "./list-buckets.route.js";

vi.mock("../use-cases/list-buckets.use-case.js");
vi.mock("../../common/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const ENTRY = {
  id: "cw.cases",
  path: "cw/cases",
  label: "Cases",
  service: "CW",
  shortLabel: "Cases",
  icon: "folder",
  order: 80,
  noun: { one: "case", many: "cases" },
  time: { label: "Created" },
  facts: [
    {
      name: "workflowCode",
      param: "workflowcode",
      label: "Workflow",
      values: [{ value: "example-workflow", label: "example-workflow" }],
      toggle: null,
    },
    {
      name: "closed",
      param: "closed",
      label: "Closed",
      values: [
        { value: "true", label: "Closed" },
        { value: "false", label: "Open" },
      ],
      toggle: null,
    },
    {
      name: "assignedUserId",
      param: "assigneduserid",
      label: "Assigned user id",
      values: null,
      toggle: null,
    },
  ],
  refs: [{ kind: "ref", label: "Reference" }],
  indexes: [[], ["workflowCode"]],
  groupings: ["workflowCode"],
  title: { label: "Reference", format: "mono" },
  columns: [{ key: "workflowCode", label: "Workflow", format: "mono" }],
  audited: true,
  timeline: false,
  summaries: [],
  page: null,
  tab: null,
};

const get = async (headers = { "x-test-client": CASE_READER_CLIENT }) =>
  (await serverFor(listBucketsRoute)).inject({
    method: "GET",
    url: "/actuators/buckets",
    headers,
  });

beforeEach(() => {
  listBucketsUseCase.mockResolvedValue({ buckets: [ENTRY] });
});

describe("listBucketsRoute", () => {
  it("is a GET on /actuators/buckets on the public API", () => {
    expect(listBucketsRoute.method).toBe("GET");
    expect(listBucketsRoute.path).toBe("/actuators/buckets");
    expect(listBucketsRoute.options.auth).toBe("public-api");
    expect(listBucketsRoute.options.tags).toEqual(["api", "public-api"]);
  });

  it("answers this service's entries, with no operator named", async () => {
    const response = await get();

    expect(response.statusCode).toBe(200);
    expect(response.result).toEqual({ buckets: [ENTRY] });
  });

  it("answers 403 to any client but fg-gas-backend", async () => {
    const response = await get({ "x-test-client": "fg-grants-platform-admin" });

    expect(response.statusCode).toBe(403);
    expect(listBucketsUseCase).not.toHaveBeenCalled();
  });

  it("answers a 500 rather than an entry off its schema", async () => {
    listBucketsUseCase.mockResolvedValue({
      buckets: [{ ...ENTRY, facts: "nope" }],
    });

    expect((await get()).statusCode).toBe(500);
  });
});
