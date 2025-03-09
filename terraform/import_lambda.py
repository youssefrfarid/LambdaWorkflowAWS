#!/usr/bin/env python3
import os
import sys
import json
import zipfile
import boto3
import requests

# Configuration
FUNCTIONS_DIR = "../functions"
TERRAFORM_DIR = "../terraform"
GENERATED_TF_FILE = os.path.join(
    TERRAFORM_DIR, "auto_generated_imported_functions.tf")


def get_lambda_function(function_name):
    client = boto3.client("lambda")
    try:
        response = client.get_function(FunctionName=function_name)
        return response
    except Exception as e:
        print(f"Error retrieving function '{function_name}': {e}")
        sys.exit(1)


def download_code(url, download_path):
    print(f"Downloading code from: {url}")
    response = requests.get(url)
    if response.status_code != 200:
        print(f"Failed to download code: HTTP {response.status_code}")
        sys.exit(1)
    with open(download_path, "wb") as f:
        f.write(response.content)
    print(f"Downloaded code to: {download_path}")


def extract_zip(zip_path, extract_to):
    print(f"Extracting {zip_path} to {extract_to} ...")
    with zipfile.ZipFile(zip_path, "r") as zip_ref:
        zip_ref.extractall(extract_to)
    print("Extraction complete.")


def generate_terraform_file(function_name, config):
    # Basic resource block with some configuration fields from AWS.
    # You can customize this as needed.
    tf_resource = f"""
resource "aws_lambda_function" "{function_name}" {{
  function_name = "{function_name}"
  role          = "{config.get('Role', 'REPLACE_WITH_ROLE_ARN')}"
  handler       = "{config.get('Handler', 'index.handler')}"
  runtime       = "{config.get('Runtime', 'nodejs18.x')}"
  filename      = "${{path.module}}/build/{function_name}.zip"

  // Ensure Terraform notices code changes in the .zip:
  source_code_hash = filebase64sha256("${{path.module}}/build/{function_name}.zip")
"""

    # Optionally add VPC configuration if available
    vpc_config = config.get("VpcConfig")
    if vpc_config:
        subnets = json.dumps(vpc_config.get("SubnetIds", []))
        sgs = json.dumps(vpc_config.get("SecurityGroupIds", []))
        tf_resource += f"""
  vpc_config {{
    subnet_ids         = {subnets}
    security_group_ids = {sgs}
  }}
"""

    # Optionally add environment variables if available
    env = config.get("Environment", {}).get("Variables")
    if env:
        env_json = json.dumps(env)
        tf_resource += f"""
  environment {{
    variables = {env_json}
  }}
"""
    tf_resource += "\n}\n"

    # Optionally, add an output block.
    tf_output = f"""
output "{function_name}_name" {{
  value = aws_lambda_function.{function_name}.function_name
}}
"""

    return tf_resource + tf_output


def main():
    if len(sys.argv) < 2:
        print("Usage: import_lambda.py <FunctionName>")
        sys.exit(1)

    function_name = sys.argv[1]
    print(f"Importing Lambda function: {function_name}")

    # Get the Lambda function details from AWS.
    function_data = get_lambda_function(function_name)
    configuration = function_data.get("Configuration", {})
    code = function_data.get("Code", {})
    code_url = code.get("Location")
    if not code_url:
        print("No code URL found in the function data.")
        sys.exit(1)

    # Create a folder in FUNCTIONS_DIR for the function.
    function_folder = os.path.join(FUNCTIONS_DIR, function_name)
    os.makedirs(function_folder, exist_ok=True)

    # Download the code package.
    zip_file_path = os.path.join(function_folder, f"{function_name}.zip")
    download_code(code_url, zip_file_path)

    # Extract the zip file into the function folder.
    extract_zip(zip_file_path, function_folder)

    # (Optional) Move the zip file to your Terraform build folder.
    build_dir = os.path.join(TERRAFORM_DIR, "build")
    os.makedirs(build_dir, exist_ok=True)
    terraform_zip_path = os.path.join(build_dir, f"{function_name}.zip")
    os.rename(zip_file_path, terraform_zip_path)
    print(f"Moved zip file to Terraform build directory: {terraform_zip_path}")

    # Generate a Terraform configuration for this function.
    tf_block = generate_terraform_file(function_name, configuration)

    # Append to (or create) the auto-generated Terraform file.
    with open(GENERATED_TF_FILE, "a") as f:
        f.write(tf_block)
        f.write("\n")

    print(
        f"Terraform configuration for '{function_name}' generated in '{GENERATED_TF_FILE}'.")
    print("To import this function into Terraform state, run:")
    print(
        f"  terraform import aws_lambda_function.{function_name} {function_name}")


if __name__ == "__main__":
    main()
