import { MongoClient } from "mongodb";

const roles = {
  ROLE_SFI_REFORM: {
    startDate: "2005-01-01",
    endDate: "3000-01-01",
  },
  ROLE_RPA_FINANCE: {
    startDate: "2005-01-01",
    endDate: "3000-01-01",
  },
};

const users = {
  readerwriter: {
    idpId: "df20f4bd-d009-4bf4-b499-46e93e0f005a",
  },
};

const DEFAULT_USER = "readerwriter";
const DEFAULT_CONNECTION_STRING =
  "mongodb://localhost:27017/fg-cw-backend?directConnection=true";

const user =
  process.argv.length > 2 ? users[process.argv[2]] : users[DEFAULT_USER];
const connection =
  process.argv.length > 3 ? users[process.argv[3]] : DEFAULT_CONNECTION_STRING;

if (!user) {
  console.error(
    `User ${process.argv[2]} not defined. Valid options are ${Object.keys(users)
      .map((u) => `"${u}"`)
      .join(", ")}`,
  );
  process.exit(1);
}

const setRoles = async (connection, user, appRoles) => {
  console.log("Setting user roles.");
  let results;
  const client = new MongoClient(connection);
  try {
    await client.connect();
    results = await client
      .db()
      .collection("users")
      .updateOne({ idpId: user.idpId }, { $set: { appRoles } });
  } catch (e) {
    console.error(e);
  } finally {
    await client.close();
  }

  if (results?.modifiedCount === 1) {
    console.log("User roles set.");
  } else if (results?.matchedCount === 1) {
    console.log("Did not update user! Roles already set.");
  } else {
    console.log("Process failed.");
  }
  console.log("Setting user roles end.");
};

setRoles(connection, user, roles);
