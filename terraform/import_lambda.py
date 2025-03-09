#!/usr/bin/env python3
import os
import sys
import json
import zipfile
import boto3
import requests

# Directories and file paths (adjust these paths as needed)
FUNCTIONS_DIR = "../functions"
TERRAFORM_DIR = "../terraform"
BUILD_DIR = os.path.join(TERRAFORM_DIR, "build")
# JSON file to hold function-specific configurations
CONFIG_FILE = "./lambda_config.json"


def load_config():
    if os.path.exists(CONFIG_FILE):
        with open(CONFIG_FILE, "r") as f:
            return json.load(f)
    return {}


def save_config(config):
    with open(CONFIG_FILE, "w") as f:
        json.dump(config, f, indent=2)


def update_function_config(function_name, config_data):
    """
    Update the configuration JSON for the imported function.
    `config_data` is a dictionary extracted from the AWS Lambda get_function response.
    """
    new_config = {}
    # Map fields from AWS configuration to our JSON configuration
    new_config["runtime"] = config_data.get("Runtime", "nodejs18.x")
    new_config["handler"] = config_data.get("Handler", "index.handler")
    new_config["role"] = config_data.get("Role", "REPLACE_WITH_ROLE_ARN")

    # Include VPC configuration if available
    if "VpcConfig" in config_data:
        new_config["vpc_config"] = {
            "subnet_ids": config_data["VpcConfig"].get("SubnetIds", []),
            "security_group_ids": config_data["VpcConfig"].get("SecurityGroupIds", []),
        }

    # Include environment variables if available
    env = config_data.get("Environment", {}).get("Variables")
    if env:
        new_config["environment"] = env

    # Optionally, include layers if available (not all functions have them)
    if "Layers" in config_data:
        new_config["layers"] = [
            layer.get("Arn") for layer in config_data["Layers"] if layer.get("Arn")]

    # Load existing config, update the function entry, and save it back.
    config = load_config()
    config[function_name] = new_config
    save_config(config)
    print(
        f"Updated configuration for function '{function_name}' in {CONFIG_FILE}.")


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


def main():
    if len(sys.argv) < 2:
        print("Usage: import_lambda.py <FunctionName>")
        sys.exit(1)

    function_name = sys.argv[1]
    print(f"Importing Lambda function: {function_name}")

    # Retrieve the function's configuration and code details from AWS.
    function_data = get_lambda_function(function_name)
    configuration = function_data.get("Configuration", {})
    code = function_data.get("Code", {})
    code_url = code.get("Location")
    if not code_url:
        print("No code URL found in the function data.")
        sys.exit(1)

    # Create a folder for the function under FUNCTIONS_DIR.
    function_folder = os.path.join(FUNCTIONS_DIR, function_name)
    os.makedirs(function_folder, exist_ok=True)

    # Download the code package as a ZIP file into the function folder.
    zip_file_path = os.path.join(function_folder, f"{function_name}.zip")
    download_code(code_url, zip_file_path)

    # Extract the zip file into the function folder.
    extract_zip(zip_file_path, function_folder)

    # Ensure the Terraform build directory exists, then move the ZIP file there.
    os.makedirs(BUILD_DIR, exist_ok=True)
    terraform_zip_path = os.path.join(BUILD_DIR, f"{function_name}.zip")
    os.rename(zip_file_path, terraform_zip_path)
    print(f"Moved zip file to Terraform build directory: {terraform_zip_path}")

    # Update the configuration JSON file with the function's settings.
    update_function_config(function_name, configuration)

    # Remind the user to import the function into Terraform.
    print("To import this function into Terraform state, run:")
    print(
        f"  terraform import aws_lambda_function.{function_name} {function_name}")


if __name__ == "__main__":
    main()
