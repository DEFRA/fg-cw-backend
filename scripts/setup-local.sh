#!/bin/bash
set -e

echo "Setting up LocalStack SNS/SQS resources for Caseworking..."

# Create SNS topics
awslocal sns create-topic --name grant-application-created
awslocal sns create-topic --name grant_application_approved

# Create queue for CW to receive messages from GAS
awslocal sqs create-queue --queue-name create_new_case

# Subscribe queue to GAS topic
awslocal sns subscribe \
  --topic-arn arn:aws:sns:us-east-1:000000000000:grant-application-created \
  --protocol sqs \
  --notification-endpoint arn:aws:sqs:us-east-1:000000000000:create_new_case

echo "✅ Caseworking SNS/SQS setup complete."
