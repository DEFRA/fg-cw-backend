import convict from "convict";
import convictFormatWithValidator from "convict-format-with-validator";
import Joi from "joi";

convict.addFormat({
  name: "mongo-uri",
  validate: function validateMongoUri(value) {
    const mongodbSchema = Joi.string().uri({
      scheme: ["mongodb"],
    });

    Joi.assert(value, mongodbSchema);
  },
});

convict.addFormats(convictFormatWithValidator);

const isProduction = process.env.NODE_ENV === "production";
const isTest = process.env.NODE_ENV === "test";

export const config = convict({
  serviceVersion: {
    doc: "The service version, this variable is injected into your docker container in CDP environments",
    format: String,
    nullable: true,
    default: null,
    env: "SERVICE_VERSION",
  },
  host: {
    doc: "The IP address to bind",
    format: "ipaddress",
    default: "0.0.0.0",
    env: "HOST",
  },
  port: {
    doc: "The port to bind",
    format: "port",
    default: 3001,
    env: "PORT",
  },
  serviceName: {
    doc: "Api Service Name",
    format: String,
    default: "fg-cw-backend",
  },
  cdpEnvironment: {
    doc: 'The CDP environment the app is running in. With the addition of "local" for local development',
    format: [
      "local",
      "infra-dev",
      "management",
      "dev",
      "test",
      "perf-test",
      "ext-test",
      "prod",
    ],
    default: "local",
    env: "ENVIRONMENT",
  },
  log: {
    isEnabled: {
      doc: "Is logging enabled",
      format: Boolean,
      default: !isTest,
      env: "LOG_ENABLED",
    },
    level: {
      doc: "Logging level",
      format: ["fatal", "error", "warn", "info", "debug", "trace", "silent"],
      default: "info",
      env: "LOG_LEVEL",
    },
    format: {
      doc: "Format to output logs in",
      format: ["ecs", "pino-pretty"],
      default: isProduction ? "ecs" : "pino-pretty",
      env: "LOG_FORMAT",
    },
    redact: {
      doc: "Log paths to redact",
      format: Array,
      default: isProduction
        ? ["req.headers.authorization", "req.headers.cookie", "res.headers"]
        : ["req", "res", "responseTime"],
    },
  },
  mongo: {
    uri: {
      doc: "URI for mongodb",
      format: String,
      default: "mongodb://127.0.0.1:27017/",
      env: "MONGO_URI",
    },
    databaseName: {
      doc: "Database name for mongodb",
      format: String,
      default: "fg-cw-backend",
      env: "MONGO_DATABASE",
    },
  },
  aws: {
    endpointUrl: {
      doc: "AWS Endpoint URL used for LocalStack",
      format: String,
      nullable: true,
      default: null,
      env: "AWS_ENDPOINT_URL",
    },
    region: {
      doc: "AWS Region",
      format: String,
      default: "eu-west-2",
      env: "AWS_REGION",
    },
    createNewCaseSqsUrl: {
      doc: "URL of the SQS queue for case creation events",
      format: String,
      default:
        "http://sqs.eu-west-2.127.0.0.1:4566/000000000000/create_new_case",
      env: "CREATE_NEW_CASE_SQS_URL",
    },
    caseStageUpdatedTopicArn: {
      doc: "ARN of the SNS topic to publish case stage updates",
      format: String,
      default: "arn:aws:sns:eu-west-2:000000000000:case_stage_updated",
      env: "CASE_STAGE_UPDATED_TOPIC_ARN",
    },
    sns: {
      caseCreatedTopicArn: {
        doc: "ARN of the SNS topic to publish case created events",
        format: String,
        default: "arn:aws:sns:eu-west-2:000000000000:cw__sns__case_created",
        env: "CW__SNS__CASE_CREATED_TOPIC_ARN",
      },
      caseStatusUpdatedTopicArn: {
        doc: "ARN of the SNS topic to publish case status updated events",
        format: String,
        default:
          "arn:aws:sns:eu-west-2:000000000000:cw__sns__case_status_updated",
        env: "CW__SNS__CASE_STATUS_UPDATED_TOPIC_ARN",
      },
    },
    sqs: {
      createNewCaseUrl: {
        doc: "URL of the SQS queue for case creation commands",
        format: String,
        default:
          "http://sqs.eu-west-2.127.0.0.1:4566/000000000000/cw__sqs__create_new_case",
        env: "CW__SQS__CREATE_NEW_CASE_URL",
      },
      updateStatusUrl: {
        doc: "URL of the SQS queue for case status update commands",
        format: String,
        default:
          "http://sqs.eu-west-2.127.0.0.0.1:4566/000000000000/cw__sqs__update_case_status",
        env: "CW__SQS__UPDATE_STATUS_URL",
      },
    },
  },
  tracing: {
    header: {
      doc: "CDP tracing header name",
      format: String,
      default: "x-cdp-request-id",
      env: "TRACING_HEADER",
    },
  },
  oidc: {
    jwks: {
      uri: {
        doc: "The JWKS URI to retrieve public keys for token verification",
        format: "url",
        default: null,
        env: "OIDC_JWKS_URI",
      },
    },
    verify: {
      aud: {
        doc: "The audience of the token",
        format: String,
        default: null,
        env: "OIDC_VERIFY_AUD",
      },
      iss: {
        doc: "The issuer of the token",
        format: "url",
        default: null,
        env: "OIDC_VERIFY_ISS",
      },
    },
  },
  entra: {
    roles: {
      doc: "Roles assigned to users in Microsoft Entra ID",
      format: Array,
      default: [
        "FCP.Casework.Read",
        "FCP.Casework.ReadWrite",
        "FCP.Casework.Admin",
      ],
      env: "AZURE_ENTRA_APP_ROLES",
    },
  },
});

config.validate({ allowed: "strict" });
