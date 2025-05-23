import convict from "convict";
import convictFormatWithValidator from "convict-format-with-validator";

import { convictValidateMongoUri } from "./common/helpers/convict/validate-mongo-uri.js";

convict.addFormat(convictValidateMongoUri);
convict.addFormats(convictFormatWithValidator);

const isProduction = process.env.NODE_ENV === "production";
const isTest = process.env.NODE_ENV === "test";

const config = convict({
  serviceVersion: {
    doc: "The service version, this variable is injected into your docker container in CDP environments",
    format: String,
    nullable: true,
    default: null,
    env: "SERVICE_VERSION"
  },
  host: {
    doc: "The IP address to bind",
    format: "ipaddress",
    default: "0.0.0.0",
    env: "HOST"
  },
  port: {
    doc: "The port to bind",
    format: "port",
    default: 3001,
    env: "PORT"
  },
  serviceName: {
    doc: "Api Service Name",
    format: String,
    default: "fg-cw-backend"
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
      "prod"
    ],
    default: "local",
    env: "ENVIRONMENT"
  },
  log: {
    isEnabled: {
      doc: "Is logging enabled",
      format: Boolean,
      default: !isTest,
      env: "LOG_ENABLED"
    },
    level: {
      doc: "Logging level",
      format: ["fatal", "error", "warn", "info", "debug", "trace", "silent"],
      default: "info",
      env: "LOG_LEVEL"
    },
    format: {
      doc: "Format to output logs in",
      format: ["ecs", "pino-pretty"],
      default: isProduction ? "ecs" : "pino-pretty",
      env: "LOG_FORMAT"
    },
    redact: {
      doc: "Log paths to redact",
      format: Array,
      default: isProduction
        ? ["req.headers.authorization", "req.headers.cookie", "res.headers"]
        : ["req", "res", "responseTime"]
    }
  },
  api: {
    pageSize: {
      doc: "Default page size for pagination",
      format: Number,
      default: 20,
      env: "DEFAULT_LIMIT"
    }
  },
  mongo: {
    uri: {
      doc: "URI for mongodb",
      format: String,
      default: "mongodb://127.0.0.1:27017/",
      env: "MONGO_URI"
    },
    databaseName: {
      doc: "Database name for mongodb",
      format: String,
      default: "fg-cw-backend",
      env: "MONGO_DATABASE"
    }
  },
  aws: {
    isLocalstackEnabled: {
      doc: "Is localstack enabled",
      format: Boolean,
      default: false,
      env: "LOCALSTACK_ENABLED"
    },
    awsRegion: {
      doc: "AWS Region",
      format: String,
      default: "eu-west-2",
      env: "AWS_REGION"
    },
    sqsEndpoint: {
      doc: "SQS Endpoint, if not using AWS default endpoint. E.g. http://localhost:4566",
      format: String,
      default: "http://localstack:4566",
      env: "SQS_ENDPOINT"
    },
    sqsWaitTimeInSeconds: {
      doc: "SQS Wait Time in Seconds",
      format: Number,
      default: 20,
      env: "SQS_WAIT_TIME_IN_SECONDS"
    },
    sqsMaxNumberOfMessages: {
      doc: "SQS Max Number of Messages",
      format: Number,
      default: 10,
      env: "SQS_MAX_NUMBER_OF_MESSAGES"
    },
    snsEndpoint: {
      doc: "SNS Endpoint, if not using AWS default endpoint. E.g. http://localhost:4566",
      format: String,
      default: "http://localstack:4566",
      env: "SNS_ENDPOINT"
    },
    createNewCaseSqsUrl: {
      doc: "URL of the SQS queue for case creation events",
      format: String,
      default:
        "http://sqs.eu-west-2.127.0.0.1:4566/000000000000/create_new_case",
      env: "CREATE_NEW_CASE_SQS_URL"
    },
    caseStageUpdatedTopicArn: {
      doc: "ARN of the SNS topic to publish case stage updates",
      format: String,
      default: "arn:aws:sns:eu-west-2:000000000000:case_stage_updated",
      env: "CASE_STAGE_UPDATED_TOPIC_ARN"
    }
  },
  httpProxy: {
    doc: "HTTP Proxy URL",
    format: String,
    nullable: true,
    default: null,
    env: "HTTP_PROXY"
  },
  isSecureContextEnabled: {
    doc: "Enable Secure Context",
    format: Boolean,
    default: isProduction,
    env: "ENABLE_SECURE_CONTEXT"
  },
  isMetricsEnabled: {
    doc: "Enable metrics reporting",
    format: Boolean,
    default: isProduction,
    env: "ENABLE_METRICS"
  },
  tracing: {
    header: {
      doc: "CDP tracing header name",
      format: String,
      default: "x-cdp-request-id",
      env: "TRACING_HEADER"
    }
  }
});

config.validate({ allowed: "strict" });

export { config };
