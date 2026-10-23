import { STORED, defineBucket } from "../../common/buckets/bucket.js";
import { FetchStatus } from "../../common/fetch-status.js";
import { ConfigVersionStatus } from "../models/config-version.js";

const statusValues = [
  {
    value: ConfigVersionStatus.Active,
    label: "Active",
    tone: "success",
    hint: "Published by the config broker.",
  },
  {
    value: ConfigVersionStatus.Draft,
    label: "Draft",
    tone: "neutral",
    hint: "Not yet published as active.",
  },
];

const definitionValues = [
  {
    value: FetchStatus.Fetched,
    label: "Stored",
    tone: "success",
    hint: "CW has loaded this version's workflow definition.",
  },
  {
    value: FetchStatus.Pending,
    label: "Not stored yet",
    tone: "neutral",
    hint: "This version's workflow definition isn't fetched by CW yet. CW fetches it from S3 when it first needs it, and only uses the newest usable Active version in each major, so an older version may never be fetched; that is normal. A workflow definition stored with Fetch definition shows here until CW loads it itself.",
  },
  {
    value: FetchStatus.TransientError,
    label: "Fetch error",
    tone: "warning",
    hint: "CW's last fetch of this version's workflow definition from S3 failed. CW tries again the next time it needs it; after 5 failed fetches it stops trying and marks it Failed the next time it needs this version. Open the version for the error.",
  },
  {
    value: FetchStatus.PermanentError,
    label: "Failed",
    tone: "error",
    hint: "CW couldn't fetch or read this version's workflow definition, or stopped after 5 failed fetches, and won't use it. Open the version to see why and what it affects; publish a fixed version.",
  },
];

export const workflowsBucket = () =>
  defineBucket({
    id: "cw.workflows",
    path: "workflows",
    label: "Workflows",
    service: "CW",
    shortLabel: "Workflows",
    icon: "workflow",
    order: 85,
    noun: { one: "workflow version", many: "workflow versions" },
    collection: "config_versions",
    time: { field: "receivedAt", type: "isoString", label: "Received" },
    facts: {
      grantCode: { label: "Workflow", param: "workflow", values: STORED },
      status: {
        label: "Status",
        param: "status",
        values: statusValues,
      },
      fetchStatus: {
        label: "Definition",
        param: "definition",
        values: definitionValues,
      },
    },
    indexes: [
      ["grantCode", "status", "fetchStatus"],
      ["status", "fetchStatus"],
    ],
    audited: false,
    timeline: false,
    title: { label: "Workflow", format: "mono" },
    columns: [
      { key: "version", label: "Version", format: "mono" },
      {
        key: "definition",
        label: "Definition",
        format: "badge",
        fact: "fetchStatus",
      },
      { key: "status", label: "Status", format: "badge", fact: "status" },
    ],
    row: {
      projection: { grantCode: 1, version: 1, status: 1, fetchStatus: 1 },
      present: (doc) => ({
        title: doc.grantCode,
        subtitle: null,
        cells: {
          version: doc.version,
          status: doc.status,
          definition: doc.fetchStatus,
        },
        link: { kind: "workflow", code: doc.grantCode, version: doc.version },
      }),
    },
  });
