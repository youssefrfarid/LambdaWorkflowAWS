
resource "aws_lambda_function" "importFunction" {
  function_name = "importFunction"
  role          = "arn:aws:iam::445567078336:role/service-role/importFunction-role-atnv3txe"
  handler       = "index.handler"
  runtime       = "nodejs18.x"
  filename      = "${path.module}/build/importFunction.zip"

  // Ensure Terraform notices code changes in the .zip:
  source_code_hash = filebase64sha256("${path.module}/build/importFunction.zip")

  environment {
    variables = {"testKey": "value"}
  }

}

output "importFunction_name" {
  value = aws_lambda_function.importFunction.function_name
}

