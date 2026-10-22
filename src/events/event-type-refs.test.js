import { describe, expect, it } from "vitest";
import { caseStatusUpdated } from "../cases/events/case-status-updated.event.js";
import {
  caseCreate,
  caseUpdateStatus,
  configVersionUpdated,
} from "../cases/events/inbound-event-types.js";
import { toRefs } from "../common/buckets/refs.js";
import { INBOX, OUTBOX, findEventType } from "./event-types.js";

const GAS = "cloud.defra.local.fg-gas-backend.";

const declared = [
  {
    eventType: caseStatusUpdated,
    sentAs: "cloud.defra.local.fg-cw-backend.case.status.updated",
    boxes: [OUTBOX],
    event: { data: { workflowCode: "example-workflow", caseRef: "abc-123" } },
    refs: [
      ["ref", "abc-123"],
      ["case", "example-workflow:abc-123"],
    ],
  },
  {
    eventType: caseCreate,
    sentAs: `${GAS}case.create`,
    boxes: [INBOX],
    event: {
      data: {
        workflowCode: "example-workflow",
        caseRef: "abc-124",
        previousCaseRef: "abc-123",
      },
    },
    refs: [
      ["ref", "abc-124"],
      ["case", "example-workflow:abc-124"],
      ["ref", "abc-123"],
      ["case", "example-workflow:abc-123"],
    ],
  },
  {
    eventType: caseUpdateStatus,
    sentAs: `${GAS}case.update.status`,
    boxes: [INBOX],
    event: { data: { workflowCode: "example-workflow", caseRef: "abc-123" } },
    refs: [
      ["ref", "abc-123"],
      ["case", "example-workflow:abc-123"],
    ],
  },
  {
    eventType: configVersionUpdated,
    sentAs: "config-version.updated",
    boxes: [INBOX],
    event: { data: { grantCode: "example-workflow", version: "1.2.3" } },
    refs: [
      ["ref", "example-workflow"],
      ["config", "example-workflow@1~2e.2~2e.3"],
    ],
  },
];

describe.each(declared)(
  "$eventType.name",
  ({ eventType, sentAs, boxes, event, refs }) => {
    it("is sent as its envelope type, to its boxes", () => {
      expect(eventType.sentAs).toBe(sentAs);
      expect(eventType.boxes).toEqual(boxes);
    });

    it("is found from its envelope", () => {
      expect(findEventType({ type: sentAs, ...event })).toBe(eventType);
    });

    it("reads its refs from the envelope", () => {
      expect(eventType.refs(event, {})).toEqual(refs);
    });

    it("never throws for an envelope that holds nothing", () => {
      expect(() => eventType.refs({}, {})).not.toThrow();
      expect(() => eventType.refs({ data: null }, {})).not.toThrow();
    });
  },
);

describe("ConfigVersionUpdated refs", () => {
  it("keeps the case of a mixed-case code in its link", () => {
    expect(
      configVersionUpdated.refs(
        { data: { grantCode: "Example-Workflow", version: "1.0.0" } },
        {},
      ),
    ).toEqual([
      ["ref", "Example-Workflow"],
      ["config", "~45.xample-~57.orkflow@1~2e.0~2e.0"],
    ]);
  });

  it("reads only the code as a reference when the version is missing", () => {
    expect(
      toRefs(
        configVersionUpdated.refs({ data: { grantCode: "woodland" } }, {}),
      ),
    ).toEqual(["ref:woodland"]);
  });

  it("reads no refs when the code is missing", () => {
    expect(
      toRefs(
        configVersionUpdated.refs(
          { data: { version: "1.0.0" } },
          { segregationRef: "unknown-grant" },
        ),
      ),
    ).toEqual([]);
  });
});
