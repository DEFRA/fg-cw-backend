import { STORED, defineBucket } from "../../common/buckets/bucket.js";
import { toPosition } from "../repositories/case/admin-case-row.js";

const orNull = (value) => value ?? null;

export const casesBucket = () =>
  defineBucket({
    id: "cw.cases",
    path: "cases",
    label: "Cases",
    service: "CW",
    shortLabel: "Cases",
    icon: "folder",
    order: 80,
    noun: { one: "case", many: "cases" },
    collection: "cases",
    time: { field: "createdAt", type: "date", label: "Created" },
    facts: {
      workflowCode: { label: "Workflow", param: "workflow", values: STORED },
    },
    refs: { ref: "Reference", sbi: "SBI" },
    indexes: [["workflowCode"]],
    audited: true,
    timeline: false,
    title: { label: "Reference", format: "mono" },
    columns: [
      { key: "workflowCode", label: "Workflow", format: "mono" },
      { key: "position", label: "Status", format: "position" },
    ],
    row: {
      projection: {
        caseRef: 1,
        workflowCode: 1,
        currentPhase: 1,
        currentStage: 1,
        currentStatus: 1,
      },
      present: (doc) => ({
        title: orNull(doc.caseRef),
        subtitle: null,
        cells: {
          workflowCode: orNull(doc.workflowCode),
          position: toPosition(doc),
        },
        link: {
          kind: "case",
          workflowCode: doc.workflowCode,
          caseRef: doc.caseRef,
        },
      }),
    },
  });
