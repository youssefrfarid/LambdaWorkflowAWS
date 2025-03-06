// THIS FILE IS AUTO-GENERATED. DO NOT EDIT DIRECTLY.
// Run 'python auto_update_terraform.py' to update.
resource "aws_lambda_function" "myNewFunction" {
  function_name = "${var.feature_name}-myNewFunction"
  role          = aws_iam_role.lambda_exec_role.arn
  handler       = "index.handler"
  runtime       = "nodejs18.x"
  filename      = "${path.module}/build/myNewFunction.zip"
}
output "myNewFunction_name" {
  value = aws_lambda_function.myNewFunction.function_name
}
resource "aws_lambda_function" "mySecondFunction" {
  function_name = "${var.feature_name}-mySecondFunction"
  role          = aws_iam_role.lambda_exec_role.arn
  handler       = "index.handler"
  runtime       = "nodejs18.x"
  filename      = "${path.module}/build/mySecondFunction.zip"
}
output "mySecondFunction_name" {
  value = aws_lambda_function.mySecondFunction.function_name
}
