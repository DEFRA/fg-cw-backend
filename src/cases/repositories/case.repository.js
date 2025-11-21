import Boom from "@hapi/boom";
import { ObjectId } from "mongodb";
import { logger } from "../../common/logger.js";
import { db } from "../../common/mongo-client.js";
import { CasePhase } from "../models/case-phase.js";
import { CaseStage } from "../models/case-stage.js";
import { CaseTaskGroup } from "../models/case-task-group.js";
import { CaseTask } from "../models/case-task.js";
import { Case } from "../models/case.js";
import { CaseDocument } from "./case/case-document.js";

const collection = "cases";

const toCaseTask = (t) =>
  new CaseTask({
    code: t.code,
    status: t.status,
    completed: t.completed,
    commentRef: t.commentRef,
    updatedAt: t.updatedAt,
    updatedBy: t.updatedBy,
    requiredRoles: t.requiredRoles,
  });

const toCaseTaskGroup = (tg) =>
  new CaseTaskGroup({
    code: tg.code,
    tasks: tg.tasks.map(toCaseTask),
  });

const toCaseStage = (s) =>
  new CaseStage({
    code: s.code,
    taskGroups: s.taskGroups.map(toCaseTaskGroup),
  });

const toCasePhase = (p) =>
  new CasePhase({
    code: p.code,
    stages: p.stages.map(toCaseStage),
  });

const toCase = (doc) => {
  return new Case({
    _id: doc._id.toHexString(),
    caseRef: doc.caseRef,
    workflowCode: doc.workflowCode,
    payload: doc.payload,
    currentPhase: doc.currentPhase,
    currentStage: doc.currentStage,
    currentStatus: doc.currentStatus,
    dateReceived: doc.dateReceived.toISOString(),
    createdAt: doc.createdAt,
    phases: doc.phases.map(toCasePhase),
    comments: doc.comments,
    timeline: doc.timeline,
    assignedUser: doc.assignedUserId
      ? {
          id: doc.assignedUserId,
        }
      : null,
    supplementaryData: doc.supplementaryData,
  });
};

export const save = async (kase, session) => {
  logger.debug("Saving new case", {
    caseRef: kase.caseRef,
    workflowCode: kase.workflowCode,
    hasSession: !!session,
  });

  const caseDocument = new CaseDocument(kase);

  let result;

  try {
    result = await db
      .collection(collection)
      .insertOne(caseDocument, { session });
    logger.debug("Case saved successfully", {
      caseRef: kase.caseRef,
      insertedId: result.insertedId,
    });
  } catch (error) {
    if (error.code === 11000) {
      logger.debug("Case save failed - duplicate key", {
        caseRef: kase.caseRef,
        workflowCode: kase.workflowCode,
      });
      throw Boom.conflict(
        `Case with caseRef "${kase.caseRef}" and workflowCode "${kase.workflowCode}" already exists`,
      );
    }
    logger.debug("Case save failed with unexpected error", {
      caseRef: kase.caseRef,
      error: error.message,
    });
    throw error;
  }

  if (!result.acknowledged) {
    logger.debug({ caseRef: kase.caseRef }, "Case save not acknowledged");
    throw Boom.internal(
      `Case with caseRef "${kase.caseRef}" and workflowCode "${kase.workflowCode}" could not be created, the operation was not acknowledged`,
    );
  }
};

export const update = async (kase) => {
  logger.debug({ caseId: kase._id, caseRef: kase.caseRef }, "Updating case");

  const caseDocument = new CaseDocument(kase);

  const result = await db
    .collection(collection)
    .replaceOne({ _id: kase.objectId }, caseDocument);

  if (result.matchedCount === 0) {
    throw Boom.notFound(`Case with id "${kase._id}" not found`);
  }

  if (!result.acknowledged) {
    throw Boom.internal(
      `Case with caseRef "${kase.caseRef}" could not be updated, the operation was not acknowledged`,
    );
  }

  return kase;
};

export const findAll = async () => {
  logger.debug("Finding all cases");
  const caseDocuments = await db.collection(collection).find().toArray();
  logger.debug("Cases found", { count: caseDocuments.length });
  return caseDocuments.map(toCase);
};

export const findByCaseRefAndWorkflowCode = async (caseRef, workflowCode) => {
  logger.debug(
    {
      caseRef,
      workflowCode,
    },
    "Finding case by caseRef and workflowCode",
  );
  const caseDocument = await db.collection(collection).findOne({
    caseRef,
    workflowCode,
  });

  const found = !!caseDocument;
  logger.debug({ caseRef, workflowCode, found }, "Case search result");

  return caseDocument && toCase(caseDocument);
};

export const findById = async (caseId) => {
  logger.debug({ caseId }, "Finding case by ID");
  const caseDocument = await db.collection(collection).findOne({
    _id: ObjectId.createFromHexString(caseId),
  });

  const found = !!caseDocument;
  logger.debug({ caseId, found }, "Case search result");

  return caseDocument && toCase(caseDocument);
};

export const updateStage = async (caseId, nextStage, timelineEvent) => {
  logger.debug(
    {
      caseId,
      nextStage,
      hasTimelineEvent: !!timelineEvent,
    },
    "Updating case stage",
  );

  const result = await db.collection(collection).updateOne(
    { _id: ObjectId.createFromHexString(caseId) },
    {
      $set: { currentStage: nextStage },
      $push: {
        timeline: {
          $each: [timelineEvent],
          $position: 0,
        },
      },
    },
  );

  logger.debug(
    {
      caseId,
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount,
    },
    "Stage update result",
  );

  if (result.matchedCount === 0) {
    throw Boom.notFound(`Case with id "${caseId}" not found`);
  }
};
