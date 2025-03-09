#!/usr/bin/env python3
import os
import json

FUNCTIONS_DIR = "../functions"
OUTPUT_FILE = "../terraform/auto_generated_functions.tf"
CONFIG_FILE = "../terraform/lambda_config.json"  # adjust path as needed


def load_config():
    if os.path.exists(CONFIG_FILE):
        with open(CONFIG_FILE, "r") as f:
            return json.load(f)
    return {}


def main():
    # Load external configuration file.
    config = load_config()

    # List only directories in the functions folder.
    function_dirs = [
        d for d in os.listdir(FUNCTIONS_DIR)
        if os.path.isdir(os.path.join(FUNCTIONS_DIR, d))
    ]

    tf_content = [
        "// THIS FILE IS AUTO-GENERATED. DO NOT EDIT DIRECTLY.",
        "// Run 'python auto_update_terraform.py' to update."
    ]

    for func in function_dirs:
        resource_name = func  # You can adjust naming as needed.

        # Fetch config options for this function if they exist.
        func_config = config.get(func, {})

        # Prepare optional blocks based on config
        layers = func_config.get("layers")
        layers_block = f'  layers = {json.dumps(layers)}' if layers is not None else ""

        vpc_config = func_config.get("vpc_config")
        if vpc_config:
            vpc_block = f"""  vpc_config {{
    subnet_ids         = {json.dumps(vpc_config.get("subnet_ids", []))}
    security_group_ids = {json.dumps(vpc_config.get("security_group_ids", []))}
  }}"""
        else:
            vpc_block = ""

        environment = func_config.get("environment")
        if environment:
            env_block = f"""  environment {{
    variables = {json.dumps(environment)}
  }}"""
        else:
            env_block = ""

        # Build the resource block with conditional inclusion of optional settings.
        resource_block = f"""
resource "aws_lambda_function" "{resource_name}" {{
  function_name = "${{var.feature_name}}-{resource_name}"
  role          = aws_iam_role.lambda_exec_role.arn
  handler       = "index.handler"
  runtime       = "nodejs18.x"
  filename      = "${{path.module}}/build/{resource_name}.zip"

  // This ensures Terraform notices code changes in the .zip:
  source_code_hash = filebase64sha256("${{path.module}}/build/{resource_name}.zip")
{layers_block}
{vpc_block}
{env_block}
}}
"""
        tf_content.append(resource_block.strip())

        # Output block for the function.
        output_block = f"""
output "{resource_name}_name" {{
  value = aws_lambda_function.{resource_name}.function_name
}}
"""
        tf_content.append(output_block.strip())

    with open(OUTPUT_FILE, "w") as f:
        f.write("\n\n".join(tf_content))
        f.write("\n")

    print(f"Terraform file '{OUTPUT_FILE}' generated successfully.")


if __name__ == "__main__":
    main()
