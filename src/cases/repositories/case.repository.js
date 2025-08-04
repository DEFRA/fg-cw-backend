import Boom from "@hapi/boom";
import { ObjectId } from "mongodb";
import { db } from "../../common/mongo-client.js";
import { CaseDocument } from "../models/case-document.js";
import { Case } from "../models/case.js";

const collection = "cases";

const toCase = (doc) =>
  new Case({
    _id: doc._id.toHexString(),
    caseRef: doc.caseRef,
    workflowCode: doc.workflowCode,
    payload: doc.payload,
    status: doc.status,
    currentStage: doc.currentStage,
    dateReceived: doc.dateReceived.toISOString(),
    createdAt: doc.createdAt,
    stages: doc.stages,
    timeline: doc.timeline,
    assignedUser: doc.assignedUserId
      ? {
          id: doc.assignedUserId,
        }
      : null,
  });

export const save = async (kase) => {
  const caseDocument = new CaseDocument(kase);

  let result;

  try {
    result = await db.collection(collection).insertOne(caseDocument);
  } catch (error) {
    if (error.code === 11000) {
      throw Boom.conflict(
        `Case with caseRef "${kase.caseRef}" and workflowCode "${kase.workflowCode}" already exists`,
      );
    }
    throw error;
  }

  if (!result.acknowledged) {
    throw Boom.internal(
      `Case with caseRef "${kase.caseRef}" and workflowCode "${kase.workflowCode}" could not be created, the operation was not acknowledged`,
    );
  }
};

export const findAll = async () => {
  const caseDocuments = await db.collection(collection).find().toArray();

  return caseDocuments.map(toCase);
};

export const findById = async (caseId) => {
  const caseDocument = await db.collection(collection).findOne({
    _id: ObjectId.createFromHexString(caseId),
  });

  return caseDocument && toCase(caseDocument);
};

export const updateStage = async (caseId, nextStage, timelineEvent) => {
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

  if (result.matchedCount === 0) {
    throw Boom.notFound(`Case with id "${caseId}" not found`);
  }
};

export const updateTaskStatus = async ({
  caseId,
  stageId,
  taskGroupId,
  taskId,
  status,
  timelineEvent,
}) => {
  const eventToPush = await timelineEvent;
  const updateOperation = {
    $set: {
      "stages.$[stage].taskGroups.$[taskGroup].tasks.$[task].status": status,
    },
  };

  // Only add timeline update if timelineEvent is provided
  if (eventToPush) {
    updateOperation.$push = {
      timeline: {
        $each: [eventToPush],
        $position: 0,
      },
    };
  }

  const result = await db.collection(collection).updateOne(
    {
      _id: ObjectId.createFromHexString(caseId),
      "stages.taskGroups.id": taskGroupId,
      "stages.taskGroups.tasks.id": taskId,
    },
    updateOperation,
    {
      arrayFilters: [
        { "stage.id": stageId },
        { "taskGroup.id": taskGroupId },
        { "task.id": taskId },
      ],
    },
  );

  if (result.matchedCount === 0) {
    throw Boom.notFound(
      `Task with caseId "${caseId}", stageId "${stageId}", taskGroupId "${taskGroupId}" and taskId "${taskId}" not found`,
    );
  }
};

export const updateAssignedUser = async (
  caseId,
  assignedUserId,
  timelineEvent,
) => {
  const result = await db.collection(collection).updateOne(
    { _id: ObjectId.createFromHexString(caseId) },
    {
      $set: {
        assignedUserId,
      },
      $push: {
        timeline: {
          $each: [timelineEvent],
          $position: 0,
        },
      },
    },
  );

  if (result.matchedCount === 0) {
    throw Boom.notFound(`Case with id "${caseId}" not found`);
  }
};
