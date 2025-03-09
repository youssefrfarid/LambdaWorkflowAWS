Param(
    # If the user provides two or more arguments, the first is FeatureName, second is FunctionID
    # If only one argument is provided, we derive FeatureName from the Git branch
    [Parameter(Position = 0)]
    [String]$Arg1,

    [Parameter(Position = 1)]
    [String]$Arg2,

    [Parameter(Position = 2)]
    [String]$Arg3,

    [Parameter(Position = 3)]
    [String]$Arg4
)

# Usage:
#   .\invoke_function.ps1 [<feature_name>] <function_logical_id> [<payload_file>] [<output_file>]
#
# Examples:
#   # Derive feature_name from current branch, use 'myFunction' as function ID
#   .\invoke_function.ps1 myFunction
#
#   # Specify both feature_name and function_logical_id
#   .\invoke_function.ps1 feature-test myFunction
#
#   # Provide custom payload/output
#   .\invoke_function.ps1 feature-test myFunction event_echo.json customOutput.json

# Check how many arguments were actually passed
$argCount = $PSBoundParameters.Count

if ($argCount -lt 1) {
    Write-Host "Usage: .\invoke_function.ps1 [<feature_name>] <function_logical_id> [<payload_file>] [<output_file>]"
    exit 1
}

# If we have at least 2 arguments, Arg1 = FeatureName, Arg2 = FunctionID
# If only 1 argument, we derive FeatureName from the Git branch
if ($argCount -ge 2) {
    $FeatureName = $Arg1
    $FunctionId = $Arg2
    $PayloadFile = if ($Arg3) { $Arg3 } else { "payload.json" }
    $OutputFile = if ($Arg4) { $Arg4 } else { "output.json" }
}
else {
    # Only one argument => user gave the function_logical_id,
    # so we derive feature_name from the git branch
    Write-Host "Deriving feature_name from current Git branch..."
    $GitBranch = (git rev-parse --abbrev-ref HEAD) -replace '/', '-'
    $FeatureName = $GitBranch
    $FunctionId = $Arg1
    $PayloadFile = if ($Arg2) { $Arg2 } else { "payload.json" }
    $OutputFile = if ($Arg3) { $Arg3 } else { "output.json" }
}

# Build the actual Lambda function name
$FunctionName = "$FeatureName-$FunctionId"

Write-Host "Invoking Lambda function '$FunctionName' with payload file '$PayloadFile'..."
Write-Host "Output will be saved to '$OutputFile'."

# Invoke the function with AWS CLI
# We capture both the command output and the exit code in $LASTEXITCODE
$logResult = aws lambda invoke `
    --function-name "$FunctionName" `
    --payload "file://$PayloadFile" `
    "$OutputFile" `
    --cli-binary-format raw-in-base64-out `
    --log-type Tail `
    --query 'LogResult' `
    --output text 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "Error invoking Lambda function. See above for details."
    exit 1
}

Write-Host "Lambda invocation complete. Response saved to '$OutputFile'."

Write-Host "CloudWatch Logs:"
# $logResult is base64-encoded. Decode and print:
try {
    $decodedLogs = [System.Text.Encoding]::UTF8.GetString(
        [System.Convert]::FromBase64String($logResult)
    )
    Write-Host $decodedLogs
}
catch {
    # If the logs are empty or not base64, just print raw
    Write-Host $logResult
}
