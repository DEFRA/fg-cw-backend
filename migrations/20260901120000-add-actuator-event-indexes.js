export const up = async (db) => {
  const inbox = db.collection("inbox");
  const outbox = db.collection("outbox");

  await inbox.createIndex({ eventTime: -1, _id: -1 });
  await inbox.createIndex({ status: 1, eventTime: -1, _id: -1 });

  await outbox.createIndex({ publicationDate: -1, _id: -1 });
  await outbox.createIndex({ status: 1, publicationDate: -1, _id: -1 });
};
