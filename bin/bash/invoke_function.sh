#!/bin/bash
# Usage: ./invoke_function.sh [<feature_name>] <function_logical_id> [<payload_file>] [<output_file>]
#
# If <feature_name> is not provided, the script will attempt to detect the current Git branch.

# Check if at least 1 argument is provided (function ID).
# Because we might not get a feature_name if user wants to rely on the current branch.
if [ "$#" -lt 1 ]; then
  echo "Usage: $0 [<feature_name>] <function_logical_id> [<payload_file>] [<output_file>]"
  exit 1
fi

# The first argument is either the feature_name or the function_logical_id,
# depending on whether the user wants to rely on the git branch for feature_name.
# We need to detect that scenario.

# Attempt to parse arguments:
if [[ "$#" -ge 2 ]]; then
  # If at least two arguments are provided, the first is feature_name, second is function_logical_id
  FEATURE_NAME=$1
  FUNCTION_ID=$2
  PAYLOAD_FILE=${3:-payload.json}
  OUTPUT_FILE=${4:-output.json}
else
  # Only one argument provided => user gave the function_logical_id,
  # so we derive feature_name from the git branch
  FEATURE_NAME=$(git rev-parse --abbrev-ref HEAD | tr '/' '-')
  FUNCTION_ID=$1
  PAYLOAD_FILE=${2:-payload.json}
  OUTPUT_FILE=${3:-output.json}
fi

# Build the actual Lambda function name
FUNCTION_NAME="${FEATURE_NAME}-${FUNCTION_ID}"

echo "Invoking Lambda function '$FUNCTION_NAME' with payload file '$PAYLOAD_FILE'..."
echo "Output will be saved to '$OUTPUT_FILE'."

LOG_RESULT=$(aws lambda invoke \
  --function-name "$FUNCTION_NAME" \
  --payload "file://$PAYLOAD_FILE" \
  "$OUTPUT_FILE" \
  --cli-binary-format raw-in-base64-out \
  --log-type Tail \
  --query 'LogResult' \
  --output text 2>&1
)

if [ $? -ne 0 ]; then
  echo "Error invoking Lambda function. See above for details."
  exit 1
fi

echo "Lambda invocation complete. Response saved to '$OUTPUT_FILE'."

echo "CloudWatch Logs:"
echo "$LOG_RESULT" | base64 --decode
