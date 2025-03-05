#!/bin/bash
# Usage: ./sync_function.sh <function_logical_id> [<feature_name>]

FUNCTION_ID=$1

if [ -z "$FUNCTION_ID" ]; then
  echo "Usage: $0 <function_logical_id> [<feature_name>]"
  exit 1
fi

# If user provided a feature_name, use that; otherwise derive from Git.
if [ -n "$2" ]; then
  FEATURE_NAME=$2
else
  FEATURE_NAME=$(git rev-parse --abbrev-ref HEAD | tr '/' '-')
fi

STACK_NAME="LambdaStack-${FEATURE_NAME}"

echo "Syncing resource '$FUNCTION_ID' in stack '$STACK_NAME' with feature name '$FEATURE_NAME'..."

sam.cmd sync --stack-name "$STACK_NAME" \
         --resource-id "$FUNCTION_ID" \
         --parameter-overrides FeatureName=$FEATURE_NAME \
         --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND \
         --watch

if [ $? -eq 0 ]; then
    echo "SAM sync completed successfully for resource '$FUNCTION_ID' in stack '$STACK_NAME'."
else
    echo "SAM sync failed. Please check the output above."
fi
