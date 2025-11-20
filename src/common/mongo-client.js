import { MongoClient } from "mongodb";
import tls from "node:tls";
import { config } from "./config.js";

export const getReadPreference = (env) => {
  return env === "production" ? "secondary" : "primary";
};

export const mongoClient = new MongoClient(config.get("mongo.uri"), {
  retryWrites: false,
  readPreference: getReadPreference(process.env.NODE_ENV),
  secureContext: tls.createSecureContext(),
});

export const db = mongoClient.db(config.get("mongo.databaseName"));
