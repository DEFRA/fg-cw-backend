#!/bin/sh

set -e

env | grep "^TRUSTSTORE_" | cut -d'=' -f2- | base64 -d > /tmp/certs.pem

export NODE_EXTRA_CA_CERTS="/tmp/certs.pem"

# Use HTTP_PROXY and HTTPS_PROXY environment variables
export GLOBAL_AGENT_ENVIRONMENT_VARIABLE_NAMESPACE=

node --import "global-agent/bootstrap.js" .

