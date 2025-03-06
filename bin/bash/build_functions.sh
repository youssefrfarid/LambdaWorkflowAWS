#!/usr/bin/env bash
set -e

FUNCTIONS_DIR="functions"
BUILD_DIR="terraform/build"

mkdir -p "$BUILD_DIR"

for functionPath in "$FUNCTIONS_DIR"/*/ ; do
  if [ -d "$functionPath" ]; then
    functionName=$(basename "$functionPath")
    echo "Building Lambda function: $functionName"

    zipFile="$BUILD_DIR/$functionName.zip"

    echo "Removing old build..."
    # This line deletes the old ZIP if it exists
    rm -f "$zipFile" 2>/dev/null || true

    # Then we create a new ZIP
    (
      cd "$functionPath"
      zip -r "../../$zipFile" .
    )

    echo "Created: $zipFile"
  fi
done

echo "All Lambda functions have been built and zipped successfully!"