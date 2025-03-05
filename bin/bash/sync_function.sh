#!/bin/bash
# Usage: ./sync_function.sh <feature_name> <function_logical_id>
# Example: ./sync_function.sh feature-my-change MyNewFunction

if [ "$#" -ne 2 ]; then
    echo "Usage: $0 <feature_name> <function_logical_id>"
    exit 1
fi

FEATURE_NAME=$1
FUNCTION_ID=$2
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
