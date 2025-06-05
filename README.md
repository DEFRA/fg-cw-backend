# fg-cw-backend

## AWS

#### Get a topics attributes (fg-gas-backend DEV)

Note that the SQS url http://sqs.eu-west-2.127.0.0.1:4566 will also work in the terminal

```bash
aws sns get-topic-attributes --topic-arn arn:aws:sns:eu-west-2:332499610595:grant_application_created
```

#### Get a queue attributes

```
aws sqs get-queue-attributes \
  --queue-url https://sqs.eu-west-2.amazonaws.com/332499610595/create_new_case --attribute-names All
```

```
aws sqs get-queue-attributes \
  --queue-url https://sqs.eu-west-2.amazonaws.com/332499610595/create_new_case-deadletter --attribute-names All
```

#### Send message to the grant_application_created topic

```
aws sns publish \
  --topic-arn "arn:aws:sns:eu-west-2:332499610595:grant_application_created" \
  --message '{"clientRef": "APPLICATION-REF-1", "code": "frps-private-beta", "createdAt": "2025-03-27T10:34:52.000Z", "submittedAt": "2025-03-28T11:30:52.000Z", "identifiers": { "sbi": "SBI001", "frn": "FIRM0001", "crn": "CUST0001", "defraId": "DEFRA0001" }, "answers": { "scheme": "SFI", "year": 2025, "hasCheckedLandIsUpToDate": true, "actionApplications": [ { "parcelId": "9238", "sheetId": "SX0679", "code": "CSAM1", "appliedFor": {"unit": "ha","quantity": 20.23 }}]}}'
```

#### Check the message has arrived in the queue

```
aws sqs receive-message \
--queue-url "https://sqs.eu-west-2.amazonaws.com/332499610595/create_new_case"
```

```
aws sqs receive-message \
--queue-url "https://sqs.eu-west-2.amazonaws.com/332499610595/create_new_case-deadletter"
```

#### Delete a message from the queue

```
aws sqs delete-message \
--queue-url https://sqs.eu-west-2.amazonaws.com/332499610595/create_new_case --receipt-handle <receipt-handle>
```

#### Purge the queue

```
aws sqs purge-queue \
--queue-url https://sqs.eu-west-2.amazonaws.com/332499610595/create_new_case
```

```
aws sqs purge-queue \
--queue-url https://sqs.eu-west-2.amazonaws.com/332499610595/create_new_case-deadletter
```

#### Test the dead letter queue

Send a message in and try to receive the message four times like so

```
awslocal sqs receive-message --visibility-timeout 0 --queue-url http://sqs.eu-west-2.127.0.0.1:4566/000000000000/create_new_case
awslocal sqs receive-message --visibility-timeout 0 --queue-url http://sqs.eu-west-2.127.0.0.1:4566/000000000000/create_new_case
awslocal sqs receive-message --visibility-timeout 0 --queue-url http://sqs.eu-west-2.127.0.0.1:4566/000000000000/create_new_case
awslocal sqs receive-message --visibility-timeout 0 --queue-url http://sqs.eu-west-2.127.0.0.1:4566/000000000000/create_new_case
```

## Docker

Launch CW and dependencies via Docker Compose:

```
docker compose up --watch --build
```

Check the container status in our system and see the container id's

```
docker ps -a
```

Run an interactive shell on a container

```
docker exec -it <container id> sh
```

## Local stack

### Useful commands

Docker compose uses localstack to replicate the aws environment.
Here are some useful commands for interacting with the localstack aws.

#### List the topics

`awslocal sns list-topics`

#### Get a topics attributes

```bash
awslocal sns get-topic-attributes --topic-arn arn:aws:sns:eu-west-2:000000000000:grant_application_created
```

#### Get a queue attributes

```
awslocal sqs get-queue-attributes \
  --queue-url http://sqs.eu-west-2.127.0.0.1:4566/000000000000/create_new_case --attribute-names All
```

```
awslocal sqs get-queue-attributes \
  --queue-url http://sqs.eu-west-2.127.0.0.1:4566/000000000000/create_new_case-deadletter --attribute-names All
```

#### Send message to the grant_application_created topic

```
awslocal sns publish \
  --topic-arn "arn:aws:sns:eu-west-2:000000000000:grant_application_created" \
  --message '{"clientRef": "APPLICATION-REF-2",
  "code": "frps-private-beta",
  "createdAt": "2025-03-27T10:34:52.000Z",
  "submittedAt": "2025-03-28T11:30:52.000Z",
  "identifiers": {
    "sbi": "SBI001",
    "frn": "FIRM0001",
    "crn": "CUST0001",
    "defraId": "DEFRA0001"
  },
  "answers": {
    "scheme": "SFI",
    "year": 2025,
    "hasCheckedLandIsUpToDate": true,
    "actionApplications": [
      {
        "parcelId": "9238",
        "sheetId": "SX0679",
        "code": "CSAM1",
        "appliedFor": {
          "unit": "ha",
          "quantity": 20.23
        }
      }
    ]
  }
}'
```

#### Check the message has arrived in the queue

```
awslocal sqs receive-message \
--queue-url "http://sqs.eu-west-2.127.0.0.1:4566/000000000000/create_new_case"
```

```
awslocal sqs receive-message \
--queue-url "http://sqs.eu-west-2.127.0.0.1:4566/000000000000/create_new_case-deadletter"
```

#### Delete a message from the queue

```
awslocal sqs delete-message \
--queue-url http://sqs.eu-west-2.127.0.0.1:4566/000000000000/create_new_case --receipt-handle <receipt-handle>
```

#### Purge the queue

```
awslocal sqs purge-queue \
--queue-url http://sqs.eu-west-2.127.0.0.1:4566/000000000000/create_new_case
```

#### Test the dead letter queue

Send a message in and try to receive the message four times like so

```
awslocal sqs receive-message --visibility-timeout 0 --queue-url http://sqs.eu-west-2.127.0.0.1:4566/000000000000/create_new_case
awslocal sqs receive-message --visibility-timeout 0 --queue-url http://sqs.eu-west-2.127.0.0.1:4566/000000000000/create_new_case
awslocal sqs receive-message --visibility-timeout 0 --queue-url http://sqs.eu-west-2.127.0.0.1:4566/000000000000/create_new_case
awslocal sqs receive-message --visibility-timeout 0 --queue-url http://sqs.eu-west-2.127.0.0.1:4566/000000000000/create_new_case
```

#### SQS Retry Mechanism

The application implements an automatic retry mechanism for failed SQS message processing:

1. When a message fails to process, it will be retried based on the `maxRetries` configuration (default: 3)
2. Each retry attempt uses exponential backoff (30s, 60s, 120s, etc.)
3. After all retry attempts are exhausted, the message is moved to the Dead Letter Queue (DLQ)
4. The retry count is tracked using SQS's built-in `ApproximateReceiveCount` attribute

To configure the maximum number of retries, set the `SQS_MAX_RETRIES` environment variable or update the default in `src/config.js`.

#### Move the DLQ messages back into the recovery queue

```
awslocal sqs start-message-move-task \
  --source-arn arn:aws:sqs:eu-west-2:000000000000:create_new_case-deadletter \
  --destination-arn arn:aws:sqs:eu-west-2:000000000000:create_new_case-recovery
```

Core delivery platform Node.js Backend Template.

- [Requirements](#requirements)
  - [Node.js](#nodejs)
- [Local development](#local-development)
  - [Setup](#setup)
  - [Development](#development)
  - [Testing](#testing)
  - [Production](#production)
  - [Npm scripts](#npm-scripts)
  - [Update dependencies](#update-dependencies)
  - [Formatting](#formatting)
    - [Windows prettier issue](#windows-prettier-issue)
- [API endpoints](#api-endpoints)
- [Development helpers](#development-helpers)
  - [MongoDB Locks](#mongodb-locks)
  - [Proxy](#proxy)
- [Docker](#docker)
  - [Development image](#development-image)
  - [Production image](#production-image)
  - [Docker Compose](#docker-compose)
  - [Dependabot](#dependabot)
  - [SonarCloud](#sonarcloud)
- [Licence](#licence)
  - [About the licence](#about-the-licence)

## Requirements

### Node.js

Please install [Node.js](http://nodejs.org/) `>= v22` and [npm](https://nodejs.org/) `>= v11`. You will find it
easier to use the Node Version Manager [nvm](https://github.com/creationix/nvm)

To use the correct version of Node.js for this application, via nvm:

```bash
cd fg-cw-backend
nvm use
```

## Local development

### Setup

Install application dependencies:

```bash
npm install
```

### Development

To run the application in `development` mode run:

```bash
docker compose up --watch --build
```

### Testing

To test the application run:

```bash
npm run test
```

or (with coverage)

```bash
npm run coverage
```

To run integration tests:

```bash
npm run test:integration
```

### Production

To mimic the application running in `production` mode locally run:

```bash
npm start
```

### Npm scripts

All available Npm scripts can be seen in [package.json](./package.json).
To view them in your command line run:

```bash
npm run
```

### Update dependencies

To update dependencies use [npm-check-updates](https://github.com/raineorshine/npm-check-updates):

> The following script is a good start. Check out all the options on
> the [npm-check-updates](https://github.com/raineorshine/npm-check-updates)

```bash
ncu --interactive --format group
```

### Formatting

#### Windows prettier issue

If you are having issues with formatting of line breaks on Windows update your global git config by running:

```bash
git config --global core.autocrlf false
```

## API endpoints

| Endpoint             | Description                    |
| :------------------- | :----------------------------- |
| `GET: /health`       | Health                         |
| `GET: /example    `  | Example API (remove as needed) |
| `GET: /example/<id>` | Example API (remove as needed) |

## Development helpers

### MongoDB Locks

If you require a write lock for Mongo you can acquire it via `server.locker` or `request.locker`:

```javascript
async function doStuff(server) {
  const lock = await server.locker.lock("unique-resource-name");

  if (!lock) {
    // Lock unavailable
    return;
  }

  try {
    // do stuff
  } finally {
    await lock.free();
  }
}
```

Keep it small and atomic.

You may use **using** for the lock resource management.
Note test coverage reports do not like that syntax.

```javascript
async function doStuff(server) {
  await using lock = await server.locker.lock("unique-resource-name");

  if (!lock) {
    // Lock unavailable
    return;
  }

  // do stuff

  // lock automatically released
}
```

Helper methods are also available in `/src/helpers/mongo-lock.js`.

### Proxy

We are using forward-proxy which is set up by default. To make use of this: `import { fetch } from 'undici'` then
because of the `setGlobalDispatcher(new ProxyAgent(proxyUrl))` calls will use the ProxyAgent Dispatcher

If you are not using Wreck, Axios or Undici or a similar http that uses `Request`. Then you may have to provide the
proxy dispatcher:

To add the dispatcher to your own client:

```javascript
import { ProxyAgent } from "undici";

return await fetch(url, {
  dispatcher: new ProxyAgent({
    uri: proxyUrl,
    keepAliveTimeout: 10,
    keepAliveMaxTimeout: 10,
  }),
});
```

## Docker

### Development image

Build:

```bash
docker build --target development --no-cache --tag fg-cw-backend:development .
```

Run:

```bash
docker run -e PORT=3001 -p 3001:3001 fg-cw-backend:development
```

### Production image

Build:

```bash
docker build --no-cache --tag fg-cw-backend .
```

Run:

```bash
docker run -e PORT=3001 -p 3001:3001 fg-cw-backend
```

### Docker Compose

A local environment with:

- Localstack for AWS services (S3, SQS)
- MongoDB
- This service.
- A commented out frontend example.

```bash
docker compose up --build -d
```

### Dependabot

We have added an example dependabot configuration file to the repository. You can enable it by renaming
the [.github/example.dependabot.yml](.github/dependabot.yml) to `.github/dependabot.yml`

### SonarCloud

Instructions for setting up SonarCloud can be found in [sonar-project.properties](./sonar-project.properties)

## Licence

THIS INFORMATION IS LICENSED UNDER THE CONDITIONS OF THE OPEN GOVERNMENT LICENCE found at:

<http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3>

The following attribution statement MUST be cited in your products and applications when using this information.

> Contains public sector information licensed under the Open Government license v3

### About the licence

The Open Government Licence (OGL) was developed by the Controller of Her Majesty's Stationery Office (HMSO) to enable
information providers in the public sector to license the use and re-use of their information under a common open
licence.

It is designed to encourage use and re-use of information freely and flexibly, with only a few conditions.
