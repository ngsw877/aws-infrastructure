#!/bin/sh

BASTION_INSTANCE_ID=$1
DB_HOST=$2

aws ssm start-session \
	--target "$BASTION_INSTANCE_ID" \
	--document-name AWS-StartPortForwardingSessionToRemoteHost \
	--parameters host="$DB_HOST",portNumber=5432,localPortNumber=15432