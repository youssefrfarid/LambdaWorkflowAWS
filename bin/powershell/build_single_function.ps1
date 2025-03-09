param([string]$FunctionName)

Write-Host "Building function: $FunctionName"

$functionDir = "functions/$FunctionName"
$zipPath = "terraform/build/$FunctionName.zip"

Write-Host "Removing old zip if it exists: $zipPath"
Remove-Item $zipPath -Force -ErrorAction Ignore

Write-Host "Compressing code from $functionDir into $zipPath"
# Compress-Archive is a built-in PowerShell cmdlet (Windows 10+, PowerShell 5+).
Compress-Archive -Path (Join-Path $functionDir "*") -DestinationPath $zipPath -Force

Write-Host "Created zip at $zipPath"
