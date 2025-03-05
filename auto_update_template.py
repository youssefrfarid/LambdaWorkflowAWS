#!/usr/bin/env python3
import os
import yaml

# Define a helper class for intrinsic !Sub values.


class Sub:
    def __init__(self, value):
        self.value = value

# Custom representer for the Sub class to output !Sub "..."


def sub_representer(dumper, data):
    return dumper.represent_scalar('!Sub', data.value)


# Register the custom representer with PyYAML.
yaml.add_representer(Sub, sub_representer)

# Base SAM template structure
template = {
    "AWSTemplateFormatVersion": "2010-09-09",
    "Transform": "AWS::Serverless-2016-10-31",
    "Description": "Auto-generated SAM template for multiple Lambda functions",
    "Parameters": {
        "FeatureName": {
            "Type": "String",
            "Default": "dev",
            "Description": "Feature branch name or environment identifier"
        }
    },
    "Resources": {}
}

functions_dir = "functions"

# Loop over each subdirectory in the functions directory
for func in os.listdir(functions_dir):
    func_path = os.path.join(functions_dir, func)
    if os.path.isdir(func_path):
        resource_name = func  # Use folder name as resource name.
        # Create a resource definition for the function using our Sub helper.
        template["Resources"][resource_name] = {
            "Type": "AWS::Serverless::Function",
            "Properties": {
                "FunctionName": Sub(f"{func}-${{FeatureName}}"),
                "CodeUri": f"{functions_dir}/{func}",
                "Handler": "index.handler",
                "Runtime": "nodejs22.x",
                "Timeout": 10,
                "Policies": [
                    "AWSLambdaBasicExecutionRole"
                ]
            }
        }

# Write the generated template to a file
with open("template.yaml", "w") as f:
    yaml.dump(template, f, sort_keys=False)

print("Template updated and saved as template_generated.yaml")
