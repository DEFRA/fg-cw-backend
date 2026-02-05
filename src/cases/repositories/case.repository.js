import Boom from "@hapi/boom";
import { ObjectId } from "mongodb";
import { db } from "../../common/mongo-client.js";
import { CasePhase } from "../models/case-phase.js";
import { CaseStage } from "../models/case-stage.js";
import { CaseTaskGroup } from "../models/case-task-group.js";
import { CaseTask } from "../models/case-task.js";
import { Case } from "../models/case.js";
import { Position } from "../models/position.js";
import { CaseDocument } from "./case/case-document.js";

const collection = "cases";

const toCaseTask = (t) =>
  new CaseTask({
    code: t.code,
    status: t.status,
    completed: t.completed,
    commentRefs: t.commentRefs || [],
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
    position: new Position({
      phaseCode: doc.currentPhase,
      stageCode: doc.currentStage,
      statusCode: doc.currentStatus,
    }),
    createdAt: doc.createdAt.toISOString(),
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
  const caseDocument = new CaseDocument(kase);

  let result;

  try {
    result = await db
      .collection(collection)
      .insertOne(caseDocument, { session });
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

export const update = async (kase) => {
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

export const encodeCursor = ({ createdAt, _id }) => {
  const data = JSON.stringify({
    t: createdAt.toISOString(),
    id: _id.toHexString(),
  });

  return Buffer.from(data).toString("base64url");
};

export const decodeCursor = (cursor) => {
  if (!cursor) return null;

  try {
    const { t, id } = JSON.parse(Buffer.from(cursor, "base64url").toString());

    return {
      createdAt: new Date(t),
      _id: new ObjectId(id),
    };
  } catch {
    throw Boom.badRequest("Cannot decode cursor");
  }
};

class CaseListItem {
  _id;
  caseRef;
  workflowCode;
  position;
  payload;
  createdAt;
}

export const findByWorkflowCodes = async (query) => {
  const nextCursor = decodeCursor(query.next);
  const prevCursor = decodeCursor(query.prev);

  let pagingFilter = {};

  // Always sort by createdAt desc
  let sort = {
    createdAt: -1,
    _id: -1,
  };

  if (nextCursor) {
    pagingFilter = {
      $or: [
        { createdAt: { $lt: nextCursor.createdAt } },
        { createdAt: nextCursor.createdAt, _id: { $lt: nextCursor._id } },
      ],
    };
  } else if (prevCursor) {
    pagingFilter = {
      $or: [
        { createdAt: { $gt: prevCursor.createdAt } },
        { createdAt: prevCursor.createdAt, _id: { $gt: prevCursor._id } },
      ],
    };
    sort = {
      createdAt: 1,
      _id: 1,
    };
  }

  const matchFilter = {
    workflowCode: {
      $in: query.workflowCodes,
    },
  };

  const filter = {
    ...matchFilter,
    ...pagingFilter,
  };

  const pageSize = 20;

  const cases = db.collection(collection);

  const [caseDocuments, total] = await Promise.all([
    cases
      .find(filter)
      .project({
        _id: 1,
        caseRef: 1,
        workflowCode: 1,
        currentPhase: 1,
        currentStage: 1,
        currentStatus: 1,
        assignedUserId: 1,
        createdAt: 1,
        payload: 1,
      })
      .sort(sort)
      .limit(pageSize + 1)
      .toArray(),
    cases.countDocuments(matchFilter),
  ]);

  const hasMore = caseDocuments.length > pageSize;

  if (hasMore) {
    caseDocuments.pop();
  }

  if (prevCursor) {
    caseDocuments.reverse();
  }

  let prev = null;
  let next = null;

  if (caseDocuments.length > 0) {
    if (nextCursor) {
      // Forward navigation: can always go back, next only if more items
      prev = encodeCursor(caseDocuments.at(0));
      next = hasMore ? encodeCursor(caseDocuments.at(-1)) : null;
    } else if (prevCursor) {
      // Backward navigation: prev only if more items, can always go forward
      prev = hasMore ? encodeCursor(caseDocuments.at(0)) : null;
      next = encodeCursor(caseDocuments.at(-1));
    } else {
      // Initial page: no prev, next only if more items
      next = hasMore ? encodeCursor(caseDocuments.at(-1)) : null;
    }
  }

  return {
    pagination: {
      prev,
      next,
      totalCount: total,
    },
    data: caseDocuments.map((doc) => {
      const item = new CaseListItem();
      item._id = doc._id;
      item.caseRef = doc.caseRef;
      item.workflowCode = doc.workflowCode;
      item.position = new Position({
        phaseCode: doc.currentPhase,
        stageCode: doc.currentStage,
        statusCode: doc.currentStatus,
      });
      item.payload = doc.payload;
      item.createdAt = doc.createdAt;
      return item;
    }),
  };
};

export const findByCaseRefAndWorkflowCode = async (caseRef, workflowCode) => {
  const caseDocument = await db.collection(collection).findOne({
    caseRef,
    workflowCode,
  });
  return caseDocument && toCase(caseDocument);
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
