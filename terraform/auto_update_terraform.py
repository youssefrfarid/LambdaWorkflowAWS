#!/usr/bin/env python3
import os

FUNCTIONS_DIR = "./functions"
OUTPUT_FILE = "./terraform/auto_generated_functions.tf"


def main():
    function_dirs = [
        d for d in os.listdir(FUNCTIONS_DIR)
        if os.path.isdir(os.path.join(FUNCTIONS_DIR, d))
    ]

    tf_content = [
        "// THIS FILE IS AUTO-GENERATED. DO NOT EDIT DIRECTLY.",
        "// Run 'python auto_update_terraform.py' to update."
    ]

    for func in function_dirs:
        resource_name = func

        resource_block = f"""
resource "aws_lambda_function" "{resource_name}" {{
  function_name = "${{var.feature_name}}-{resource_name}"
  role          = aws_iam_role.lambda_exec_role.arn
  handler       = "index.handler"
  runtime       = "nodejs18.x"
  filename      = "${{path.module}}/build/{resource_name}.zip"
}}
"""
        tf_content.append(resource_block.strip("\n"))

        # Create an output block for each function
        output_block = f"""
output "{resource_name}_name" {{
  value = aws_lambda_function.{resource_name}.function_name
}}
"""
        tf_content.append(output_block.strip("\n"))

    with open(OUTPUT_FILE, "w") as f:
        f.write("\n".join(tf_content))
        f.write("\n")

    print(f"Terraform file '{OUTPUT_FILE}' generated successfully.")


if __name__ == "__main__":
    main()
