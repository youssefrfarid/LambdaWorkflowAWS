#!/bin/bash
# Usage: ./sync_function.sh [<feature_name>]

# If user provided a feature_name, use that; otherwise derive from Git.
if [ -n "$1" ]; then
  FEATURE_NAME=$1
else
  FEATURE_NAME=$(git rev-parse --abbrev-ref HEAD | tr '/' '-')
fi

STACK_NAME="LambdaStack-${FEATURE_NAME}"

echo "Syncing resources in stack '$STACK_NAME' with feature name '$FEATURE_NAME'..."

sam.cmd sync --stack-name "$STACK_NAME" \
         --parameter-overrides FeatureName=$FEATURE_NAME \
         --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND \
         --watch

if [ $? -eq 0 ]; then
    echo "SAM sync completed successfully for resources in stack '$STACK_NAME'."
else
    echo "SAM sync failed. Please check the output above."
fi
