#!/usr/bin/env bash
#
# Usage: ./check_import_resources.sh <feature_name>
#
# Example:
#   ./check_import_resources.sh prod
#
# This script:
#  1) Checks if the IAM role "lambda-exec-role-<feature_name>" exists. If yes, import it.
#  2) Scans the ../functions/ directory for subfolders (e.g., myNewFunction).
#     For each folder, it checks if a Lambda named "<feature_name>-<folderName>" exists.
#     If yes, it imports it into Terraform state.

# We temporarily disable "exit on error" so we can handle AWS CLI failures gracefully.
set +e

FEATURE_NAME="$1"
if [ -z "$FEATURE_NAME" ]; then
  echo "Usage: $0 <feature_name>"
  exit 1
fi

# --------------------------------------------
# A) Import IAM Role if it exists
# --------------------------------------------
ROLE_NAME="lambda-exec-role-$FEATURE_NAME"
echo "Checking if IAM role '$ROLE_NAME' exists..."
aws iam get-role --role-name "$ROLE_NAME"
ROLE_EXISTS=$?

if [ $ROLE_EXISTS -eq 0 ]; then
  echo "IAM role '$ROLE_NAME' already exists. Attempting to import into Terraform..."
  terraform import "aws_iam_role.lambda_exec_role" "$ROLE_NAME" || true
else
  echo "IAM role '$ROLE_NAME' does not exist. Terraform will create it."
fi

# --------------------------------------------
# B) Import Lambda Functions if they exist
# --------------------------------------------
FUNCTIONS_DIR="../functions"

for folder in "$FUNCTIONS_DIR"/*/; do
  if [ -d "$folder" ]; then
    folderName=$(basename "$folder")   # e.g. "myNewFunction"
    LAMBDA_NAME="${FEATURE_NAME}-${folderName}"  # e.g. "prod-myNewFunction"

    echo "Checking if Lambda function '$LAMBDA_NAME' exists..."
    aws lambda get-function --function-name "$LAMBDA_NAME"
    LAMBDA_EXISTS=$?

    if [ $LAMBDA_EXISTS -eq 0 ]; then
      echo "Lambda function '$LAMBDA_NAME' found. Importing into Terraform..."
      terraform import "aws_lambda_function.$folderName" "$LAMBDA_NAME" || true
    else
      echo "Lambda function '$LAMBDA_NAME' does not exist. Terraform will create it."
    fi
  fi
done

# Re-enable "exit on error"
set -e
echo "Check & Import script finished."
