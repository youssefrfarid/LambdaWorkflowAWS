// THIS FILE IS AUTO-GENERATED. DO NOT EDIT DIRECTLY.

// Run 'node auto_update_terraform.js' to update.

resource "aws_lambda_function" "importFunction" {
  function_name = "${var.feature_name == "prod" ? "importFunction" : "${var.feature_name}-importFunction"}"
  role          = aws_iam_role.lambda_exec_role.arn
  handler       = "index.handler"
  runtime       = "nodejs18.x"
  filename      = "${path.module}/build/importFunction.zip"

  // This ensures Terraform notices code changes in the .zip:
  source_code_hash = filebase64sha256("${path.module}/build/importFunction.zip")


  environment {
    variables = {"testKey":"value"}
  }
}

output "importFunction_name" {
  value = aws_lambda_function.importFunction.function_name
}

resource "aws_lambda_function" "myNewFunction" {
  function_name = "${var.feature_name == "prod" ? "myNewFunction" : "${var.feature_name}-myNewFunction"}"
  role          = aws_iam_role.lambda_exec_role.arn
  handler       = "index.handler"
  runtime       = "nodejs18.x"
  filename      = "${path.module}/build/myNewFunction.zip"

  // This ensures Terraform notices code changes in the .zip:
  source_code_hash = filebase64sha256("${path.module}/build/myNewFunction.zip")



}

output "myNewFunction_name" {
  value = aws_lambda_function.myNewFunction.function_name
}

resource "aws_lambda_function" "mySecondFunction" {
  function_name = "${var.feature_name == "prod" ? "mySecondFunction" : "${var.feature_name}-mySecondFunction"}"
  role          = aws_iam_role.lambda_exec_role.arn
  handler       = "index.handler"
  runtime       = "nodejs18.x"
  filename      = "${path.module}/build/mySecondFunction.zip"

  // This ensures Terraform notices code changes in the .zip:
  source_code_hash = filebase64sha256("${path.module}/build/mySecondFunction.zip")



}

output "mySecondFunction_name" {
  value = aws_lambda_function.mySecondFunction.function_name
}
