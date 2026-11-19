import { beforeEach, describe, expect, it } from "vitest";
import { casesBucket } from "../../cases/buckets/cases.bucket.js";
import { inboxBucket } from "../../cases/buckets/inbox.bucket.js";
import { outboxBucket } from "../../cases/buckets/outbox.bucket.js";
import { workflowsBucket } from "../../cases/buckets/workflows.bucket.js";
import { casesSource } from "../../cases/explore/cases.source.js";
import { workflowsSource } from "../../cases/explore/workflows.source.js";
import { TaskDocument } from "../../cases/repositories/case/task-document.js";
import { clearBuckets, registerBucket } from "../../common/buckets/registry.js";
import {
  clearExploreSources,
  registerExploreSource,
} from "../../common/explore-sources/registry.js";
import { rootsOf } from "../../common/explore/describe.js";
import { pathProblem } from "../../common/explore/paths.js";
import { eventsSource } from "../../events/explore/events.source.js";
import { findOwnSource, ownSources } from "./sources.js";

const BUCKETS = {
  "cw.cases": casesBucket(),
  "cw.workflows": workflowsBucket(),
  "cw.outbox": outboxBucket(),
  "cw.inbox": inboxBucket(),
};

const SOURCES = [casesSource, workflowsSource, eventsSource];

beforeEach(() => {
  clearBuckets();
  Object.values(BUCKETS).forEach(registerBucket);
  clearExploreSources();
  [eventsSource, workflowsSource, casesSource].forEach(registerExploreSource);
});

const readableOf = (source) => ({
  name: source.name,
  roots: rootsOf(source),
  paths: source.paths.map(({ path }) => path),
});

describe("ownSources", () => {
  it("reads exactly these roots and paths of each source", () => {
    expect(ownSources().map(readableOf)).toEqual([
      {
        name: "cases",
        roots: [
          "caseRef",
          "workflowCode",
          "currentConfigVersion",
          "originalConfigVersion",
          "currentPhase",
          "currentStage",
          "currentStatus",
          "createdAt",
          "closed",
          "closedAt",
          "assignedUserId",
          "payload",
          "phases",
          "supplementaryData",
          "refs",
        ],
        paths: [
          "caseRef",
          "workflowCode",
          "currentConfigVersion",
          "createdAt",
          "refs",
          "payload.identifiers.sbi",
          "payload.identifiers.frn",
          "payload.identifiers.crn",
          "currentPhase",
          "currentStage",
          "currentStatus",
          "assignedUserId",
          "closed",
          "closedAt",
          "payload.submittedAt",
          "supplementaryData.agreements.agreementRef",
          "supplementaryData.agreements.agreementStatus",
          "phases.stages.taskGroups.tasks.code",
          "phases.stages.taskGroups.tasks.value",
          "phases.stages.taskGroups.tasks.completed",
        ],
      },
      {
        name: "workflows",
        roots: [
          "grantCode",
          "version",
          "major",
          "minor",
          "patch",
          "status",
          "fetchStatus",
          "fetchAttempts",
          "fetchedAt",
          "receivedAt",
          "definition.code",
          "definition.version",
          "definition.phases",
          "definition.pages",
          "definition.requiredRoles",
          "definition.templates",
        ],
        paths: [
          "grantCode",
          "version",
          "status",
          "fetchStatus",
          "receivedAt",
          "definition.phases.code",
          "definition.phases.stages.code",
          "definition.phases.stages.name",
          "definition.phases.stages.statuses.code",
          "definition.phases.stages.taskGroups.tasks.code",
          "definition.phases.stages.statuses.transitions.action.code",
        ],
      },
      {
        name: "events",
        roots: [
          "eventType",
          "status",
          "publicationDate",
          "eventTime",
          "target",
          "type",
          "source",
          "messageId",
          "event.id",
          "event.type",
          "event.source",
          "event.time",
          "event.specversion",
          "event.datacontenttype",
          "event.data",
          "completionAttempts",
          "completionDate",
          "lastResubmissionDate",
          "lastError",
          "errorKey",
          "refs",
          "service",
          "box",
        ],
        paths: [
          "publicationDate",
          "service",
          "box",
          "eventType",
          "status",
          "errorKey",
          "lastError.name",
          "refs",
          "event.id",
          "event.type",
          "event.source",
          "event.time",
          "event.data.clientRef",
          "event.data.code",
          "event.data.caseRef",
          "event.data.workflowCode",
          "event.data.agreementNumber",
          "event.data.identifiers.sbi",
          "event.data.newStatus",
          "target",
          "lastError.message",
          "completionAttempts",
          "completionDate",
        ],
      },
    ]);
  });

  it("reads each source's buckets from the bucket registry", () => {
    const [cases, workflows] = ownSources();

    expect(cases.boxes).toEqual([
      {
        id: "cw.cases",
        bucket: BUCKETS["cw.cases"],
        service: "CW",
        box: "cases",
      },
    ]);
    expect(workflows.bucket).toBe(BUCKETS["cw.workflows"]);
  });

  it("lists a source it has no place for after the others", () => {
    registerExploreSource({ name: "later", roots: [], paths: [] });

    expect(ownSources().map(({ name }) => name)).toEqual([
      "cases",
      "workflows",
      "events",
      "later",
    ]);
  });

  it("is empty until the modules register their sources", () => {
    clearExploreSources();

    expect(ownSources()).toEqual([]);
  });
});

describe("findOwnSource", () => {
  it("finds a registered source with its buckets", () => {
    expect(
      findOwnSource("events").boxes.map(({ id, bucket }) => [id, bucket]),
    ).toEqual([
      ["cw.outbox", BUCKETS["cw.outbox"]],
      ["cw.inbox", BUCKETS["cw.inbox"]],
    ]);
  });

  it("finds nothing by a name no module registered", () => {
    expect(findOwnSource("payments")).toBeNull();
  });
});

const bucketsOf = (source) =>
  source.boxes
    ? source.boxes.map(({ bucket }) => BUCKETS[bucket])
    : [BUCKETS[source.bucket]];

const declaresRef = (bucket, kind) =>
  Object.hasOwn(bucket.refs, kind) || bucket.links.includes(kind);

const readable = (source) => (path) =>
  pathProblem(path, { roots: rootsOf(source) });

describe("casesSource, workflowsSource and eventsSource", () => {
  it.each(SOURCES)(
    "$name reads only facts, ref kinds and times its buckets declare",
    (source) => {
      source.paths
        .filter(({ index }) => index)
        .forEach(({ path, index }) =>
          bucketsOf(source).forEach((bucket) => {
            const declared = [
              !index.fact || Object.hasOwn(bucket.facts, index.fact),
              !index.ref || declaresRef(bucket, index.ref),
              !index.time || bucket.time.field === path,
            ];

            expect([path, declared]).toEqual([path, [true, true, true]]);
          }),
        );
    },
  );

  it.each(SOURCES)(
    "$name lists each path once, may read every path it knows and shows, and opens a record",
    (source) => {
      const paths = source.paths.map(({ path }) => path);

      expect(new Set(paths).size).toBe(paths.length);
      expect([...paths, ...source.star].filter(readable(source))).toEqual([]);
      expect(source.star).toContain(source.time);
      expect(typeof source.open).toBe("function");
    },
  );

  it.each(SOURCES)("$name's time is its buckets' time", (source) => {
    bucketsOf(source).forEach((bucket) =>
      expect(bucket.time.field).toBe(source.time),
    );
  });

  it.each([
    [casesSource, "comments.text"],
    [casesSource, "timeline.createdBy"],
    [casesSource, "_id"],
    [workflowsSource, "definition.endpoints.url"],
    [workflowsSource, "definition.externalActions"],
    [workflowsSource, "definition.definitions.agreementsService"],
    [workflowsSource, "s3Key"],
    [eventsSource, "event.audit.details.security.actor.email"],
    [eventsSource, "event.ip"],
    [eventsSource, "claimedBy"],
    [eventsSource, "segregationRef"],
  ])("%o can't read %s", (source, path) => {
    expect(readable(source)(path)).not.toBeNull();
  });

  it("reads what the union adds to each event: its service and box", () => {
    const ctx = { service: "CW", box: "inbox" };

    expect(eventsSource.added.service({}, ctx)).toEqual(["CW"]);
    expect(eventsSource.added.box({}, ctx)).toEqual(["inbox"]);
  });

  it("suggests a case's answers under its answers", () => {
    expect(casesSource.answersAt).toBe("payload.answers");
  });

  it("offers only what a stored case's task holds", () => {
    const TASKS = "phases.stages.taskGroups.tasks.";
    const held = Object.keys(new TaskDocument({}));

    const offered = casesSource.paths
      .map(({ path }) => path)
      .filter((path) => path.startsWith(TASKS))
      .map((path) => path.slice(TASKS.length));

    expect(offered.filter((name) => !held.includes(name))).toEqual([]);
    expect(offered).toContain("value");
  });

  it("attaches the stored definitions, named for a refusal", () => {
    expect(workflowsSource.attach).toEqual([
      expect.objectContaining({
        collection: "workflows",
        noun: "workflow definitions",
      }),
    ]);
  });
});
