export const up = async (db) => {
  const users = db.collection("users");
  await users.drop().catch(() => {});
  await users.createIndex({ idpId: 1 }, { unique: true });

  const roles = db.collection("roles");
  await roles.drop().catch(() => {});
  await roles.createIndex({ code: 1 }, { unique: true });

  const cases = db.collection("cases");
  await cases.drop().catch(() => {});
  await cases.createIndex({ workflowCode: 1, caseRef: 1 }, { unique: true });

  const workflows = db.collection("workflows");
  await workflows.drop().catch(() => {});
  await workflows.createIndex({ code: 1 }, { unique: true });

  const outbox = db.collection("outbox");
  await outbox.drop().catch(() => {});
  await outbox.createIndex({
    status: 1,
    claimedBy: 1,
    completionAttempts: 1,
    publicationDate: 1,
  });
  await outbox.createIndex({ claimExpiresAt: 1 });
  await outbox.createIndex({ status: 1, completionAttempts: 1 });

  const inbox = db.collection("inbox");
  await inbox.drop().catch(() => {});
  await inbox.createIndex({
    status: 1,
    claimedBy: 1,
    completionAttempts: 1,
    publicationDate: 1,
  });
  await inbox.createIndex({ messageId: 1 });
  await inbox.createIndex({ claimExpiresAt: 1 });
  await inbox.createIndex({ status: 1, completionAttempts: 1 });
};
