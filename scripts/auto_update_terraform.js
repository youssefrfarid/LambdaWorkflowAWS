#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const FUNCTIONS_DIR = path.join(__dirname, '../functions');
const OUTPUT_FILE = path.join(__dirname, '../terraform/auto_generated_functions.tf');
const CONFIG_FILE = path.join(__dirname, '../terraform/lambda_config.json');

function loadConfig() {
    if (fs.existsSync(CONFIG_FILE)) {
        return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    }
    return {};
}

function main() {
    // Load external configuration file.
    const config = loadConfig();

    // List only directories in the functions folder.
    const functionDirs = fs.readdirSync(FUNCTIONS_DIR).filter(dir => {
        const fullPath = path.join(FUNCTIONS_DIR, dir);
        return fs.statSync(fullPath).isDirectory();
    });

    const tfContent = [
        "// THIS FILE IS AUTO-GENERATED. DO NOT EDIT DIRECTLY.",
        "// Run 'node auto_update_terraform.js' to update."
    ];

    functionDirs.forEach(func => {
        const resourceName = func; // You can adjust naming as needed.
        const funcConfig = config[func] || {};

        // Prepare optional blocks based on config
        let layersBlock = "";
        if (funcConfig.layers !== undefined) {
            layersBlock = `  layers = ${JSON.stringify(funcConfig.layers)}`;
        }

        let vpcBlock = "";
        if (funcConfig.vpc_config) {
            vpcBlock = `  vpc_config {
    subnet_ids         = ${JSON.stringify(funcConfig.vpc_config.subnet_ids || [])}
    security_group_ids = ${JSON.stringify(funcConfig.vpc_config.security_group_ids || [])}
  }`;
        }

        let envBlock = "";
        if (funcConfig.environment) {
            envBlock = `  environment {
    variables = ${JSON.stringify(funcConfig.environment)}
  }`;
        }

        // Build the resource block with conditional inclusion of optional settings.
        const resourceBlock = `
resource "aws_lambda_function" "${resourceName}" {
  function_name = "\${var.feature_name == \"prod\" ? \"${resourceName}\" : \"\${var.feature_name}-${resourceName}\"}"
  role          = aws_iam_role.lambda_exec_role.arn
  handler       = "index.handler"
  runtime       = "nodejs18.x"
  filename      = "\${path.module}/build/${resourceName}.zip"

  // This ensures Terraform notices code changes in the .zip:
  source_code_hash = filebase64sha256("\${path.module}/build/${resourceName}.zip")
${layersBlock ? layersBlock : ""}
${vpcBlock ? vpcBlock : ""}
${envBlock ? envBlock : ""}
}`;
        tfContent.push(resourceBlock.trim());

        // Output block for the function.
        const outputBlock = `
output "${resourceName}_name" {
  value = aws_lambda_function.${resourceName}.function_name
}
`;
        tfContent.push(outputBlock.trim());
    });

    fs.writeFileSync(OUTPUT_FILE, tfContent.join('\n\n') + '\n');
    console.log(`Terraform file '${OUTPUT_FILE}' generated successfully.`);
}

main();
