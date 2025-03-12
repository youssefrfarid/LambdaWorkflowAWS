#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const https = require('https');
const { URL } = require('url');
const AWS = require('aws-sdk');
const AdmZip = require('adm-zip');

// Directories and file paths (adjust these paths as needed)
const FUNCTIONS_DIR = path.join(__dirname, '../functions');
const TERRAFORM_DIR = path.join(__dirname, '../terraform');
const BUILD_DIR = path.join(TERRAFORM_DIR, 'build');
// JSON file to hold function-specific configurations
const CONFIG_FILE = path.join(TERRAFORM_DIR, 'lambda_config.json');

function loadConfig() {
    if (fs.existsSync(CONFIG_FILE)) {
        const data = fs.readFileSync(CONFIG_FILE, 'utf8');
        return JSON.parse(data);
    }
    return {};
}

function saveConfig(config) {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

function updateFunctionConfig(functionName, configData) {
    // Map fields from AWS configuration to our JSON configuration
    const newConfig = {};
    newConfig.runtime = configData.Runtime || 'nodejs18.x';
    newConfig.handler = configData.Handler || 'index.handler';
    newConfig.role = configData.Role || 'REPLACE_WITH_ROLE_ARN';

    if (configData.VpcConfig) {
        newConfig.vpc_config = {
            subnet_ids: configData.VpcConfig.SubnetIds || [],
            security_group_ids: configData.VpcConfig.SecurityGroupIds || []
        };
    }

    const env = configData.Environment && configData.Environment.Variables;
    if (env) {
        newConfig.environment = env;
    }

    if (configData.Layers) {
        newConfig.layers = configData.Layers
            .filter(layer => layer.Arn)
            .map(layer => layer.Arn);
    }

    // Load existing config, update the function entry, and save it back.
    const config = loadConfig();
    config[functionName] = newConfig;
    saveConfig(config);
    console.log(`Updated configuration for function '${functionName}' in ${CONFIG_FILE}.`);
}

async function getLambdaFunction(functionName) {
    AWS.config.update({ region: 'eu-central-1' });
    const lambda = new AWS.Lambda();
    try {
        const response = await lambda.getFunction({ FunctionName: functionName }).promise();
        return response;
    } catch (error) {
        console.error(`Error retrieving function '${functionName}': ${error.message}`);
        process.exit(1);
    }
}

function downloadCode(url, downloadPath) {
    return new Promise((resolve, reject) => {
        console.log(`Downloading code from: ${url}`);
        const parsedUrl = new URL(url);
        const options = {
            hostname: parsedUrl.hostname,
            path: parsedUrl.pathname + parsedUrl.search,
            protocol: parsedUrl.protocol,
        };

        https.get(options, (res) => {
            if (res.statusCode !== 200) {
                reject(new Error(`Failed to download code: HTTP ${res.statusCode}`));
                return;
            }
            const fileStream = fs.createWriteStream(downloadPath);
            res.pipe(fileStream);
            fileStream.on('finish', () => {
                fileStream.close();
                console.log(`Downloaded code to: ${downloadPath}`);
                resolve();
            });
        }).on('error', (err) => {
            reject(err);
        });
    });
}

function extractZip(zipPath, extractTo) {
    console.log(`Extracting ${zipPath} to ${extractTo} ...`);
    const zip = new AdmZip(zipPath);
    zip.extractAllTo(extractTo, true);
    console.log('Extraction complete.');
}

async function main() {
    if (process.argv.length < 3) {
        console.error('Usage: import_lambda.js <FunctionName>');
        process.exit(1);
    }

    const functionName = process.argv[2];
    console.log(`Importing Lambda function: ${functionName}`);

    // Retrieve the function's configuration and code details from AWS.
    const functionData = await getLambdaFunction(functionName);
    const configuration = functionData.Configuration || {};
    const code = functionData.Code || {};
    const codeUrl = code.Location;
    if (!codeUrl) {
        console.error('No code URL found in the function data.');
        process.exit(1);
    }

    // Create a folder for the function under FUNCTIONS_DIR.
    const functionFolder = path.join(FUNCTIONS_DIR, functionName);
    if (!fs.existsSync(functionFolder)) {
        fs.mkdirSync(functionFolder, { recursive: true });
    }

    // Download the code package as a ZIP file into the function folder.
    const zipFilePath = path.join(functionFolder, `${functionName}.zip`);
    try {
        await downloadCode(codeUrl, zipFilePath);
    } catch (error) {
        console.error(`Error downloading code: ${error.message}`);
        process.exit(1);
    }

    // Extract the zip file into the function folder.
    extractZip(zipFilePath, functionFolder);

    // Ensure the Terraform build directory exists, then move the ZIP file there.
    if (!fs.existsSync(BUILD_DIR)) {
        fs.mkdirSync(BUILD_DIR, { recursive: true });
    }
    const terraformZipPath = path.join(BUILD_DIR, `${functionName}.zip`);
    fs.renameSync(zipFilePath, terraformZipPath);
    console.log(`Moved zip file to Terraform build directory: ${terraformZipPath}`);

    // Update the configuration JSON file with the function's settings.
    updateFunctionConfig(functionName, configuration);
}

main();
