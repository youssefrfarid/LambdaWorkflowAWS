#!/usr/bin/env bash
# Usage: build_single_function.sh <functionName>
#
# Zips the specified function into terraform/build/<functionName>.zip

FUNCTION_NAME="$1"
if [ -z "$FUNCTION_NAME" ]; then
  echo "Usage: $0 <functionName>"
  exit 1
fi

FUNCTION_DIR="functions/$FUNCTION_NAME"
ZIP_PATH="terraform/build/$FUNCTION_NAME.zip"

echo "Building function: $FUNCTION_NAME from $FUNCTION_DIR"

rm -f "$ZIP_PATH" 2>/dev/null || true

cd "$FUNCTION_DIR"
zip -r "../../$ZIP_PATH" . > /dev/null
echo "Created zip at $ZIP_PATH"
