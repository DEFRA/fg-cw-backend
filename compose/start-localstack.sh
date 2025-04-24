#!/bin/bash
export AWS_REGION=eu-west-2
export AWS_DEFAULT_REGION=eu-west-2
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test

# S3 buckets
# aws --endpoint-url=http://localhost:4566 s3 mb s3://my-bucket

# SNS topic
aws --endpoint-url=http://localhost:4566 sns create-topic --name grant_application_created

# SQS queues
aws --endpoint-url=http://localhost:4566 sqs create-queue --queue-name create_new_case
aws --endpoint-url=http://localhost:4566 sqs create-queue --queue-name create_new_case-deadletter
aws --endpoint-url=http://localhost:4566 sqs create-queue --queue-name create_new_case-recovery

# Configure dead letter queue
aws --endpoint-url=http://localhost:4566 sqs set-queue-attributes \
--queue-url http://sqs.eu-west-2.127.0.0.1:4566/000000000000/create_new_case \
--attributes '{ "RedrivePolicy": "{\"deadLetterTargetArn\":\"arn:aws:sqs:eu-west-2:000000000000:create_new_case-deadletter\", \"maxReceiveCount\":\"3\", \"visibilityTimeout\":\"30\"}" }'

# Subscribe queue to topic
aws --endpoint-url=http://localhost:4566 sns subscribe --topic-arn arn:aws:sns:eu-west-2:000000000000:grant_application_created \
--protocol sqs --notification-endpoint arn:aws:sqs:eu-west-2:000000000000:create_new_case \
--attributes '{ "RawMessageDelivery": "true"}'
