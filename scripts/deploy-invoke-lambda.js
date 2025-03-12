#!/usr/bin / env node

const { spawn } = require('child_process');
const path = require('path');

// Helper function to run shell commands
function runCmd(cmd, args, options = {}) {
    return new Promise((resolve, reject) => {
        console.log(`Running: ${cmd} ${args.join(' ')}`);
        const child = spawn(cmd, args, { stdio: 'inherit', shell: true, ...options });
        child.on('error', (err) => reject(err));
        child.on('close', (code) => {
            if (code !== 0) {
                reject(new Error(`${cmd} exited with code ${code}`));
            } else {
                resolve();
            }
        });
    });
}

// Get the current Git branch and replace any slashes with dashes
function getLocalGitBranch() {
    return new Promise((resolve, reject) => {
        const child = spawn('git', ['rev-parse', '--abbrev-ref', 'HEAD']);
        let output = '';
        child.stdout.on('data', (data) => output += data.toString());
        child.on('close', (code) => {
            if (code === 0) {
                resolve(output.trim().replace(/\//g, '-'));
            } else {
                reject(new Error('Failed to detect local Git branch'));
            }
        });
    });
}

// Check if the IAM role exists and import it into Terraform state if so
async function importIamRoleIfExists(featureName) {
    const roleName = `lambda-exec-role-${featureName}`;
    console.log(`Checking for IAM role '${roleName}'...`);
    return new Promise((resolve) => {
        const child = spawn('aws', ['iam', 'get-role', '--role-name', roleName]);
        let stderrOut = '';
        child.stderr.on('data', (data) => { stderrOut += data.toString(); });
        child.on('close', async (code) => {
            if (code === 0) {
                console.log(`Role '${roleName}' found. Importing into Terraform state...`);
                try {
                    await runCmd('terraform', ['import', 'aws_iam_role.lambda_exec_role', roleName], { cwd: 'terraform' });
                } catch (e) {
                    console.log("Terraform import error (likely already managed):", e.message);
                }
            } else {
                console.log(`Role '${roleName}' not found. Skipping import.`);
            }
            resolve();
        });
    });
}

// Check if the Lambda function exists and import it into Terraform state if so
async function importLambdaIfExists(featureName, functionName) {
    var awsName;
    if (featureName == "prod") {
        awsName = `${functionName}`;
    } else {
        awsName = `${featureName}-${functionName}`;
    }

    console.log(`Checking for Lambda function '${awsName}'...`);
    return new Promise((resolve) => {
        const child = spawn('aws', ['lambda', 'get-function', '--function-name', awsName]);
        let stderrOut = '';
        child.stderr.on('data', (data) => { stderrOut += data.toString(); });
        child.on('close', async (code) => {
            if (code === 0) {
                console.log(`Lambda '${awsName}' exists. Importing into Terraform state...`);
                try {
                    await runCmd('terraform', ['import', `aws_lambda_function.${functionName}`, awsName], { cwd: 'terraform' });
                } catch (e) {
                    console.log("Terraform import error (likely already managed):", e.message);
                }
            } else {
                console.log(`Lambda '${awsName}' not found. It will be created.`);
            }
            resolve();
        });
    });
}

// Build and deploy the Lambda function using Terraform
async function buildAndDeployFunction(featureName, functionName) {
    const BUILD_SCRIPT = path.join('bin', 'powershell', 'build_single_function.ps1');
    const TERRAFORM_DIR = 'terraform';

    // Build the function (using your Powershell build script)
    console.log(`Building function '${functionName}'...`);
    await runCmd('powershell', ['-File', BUILD_SCRIPT, functionName]);

    // Terraform steps: init, plan (targeting just this Lambda), and apply
    console.log('Initializing Terraform...');
    await runCmd('terraform', ['init'], { cwd: TERRAFORM_DIR });

    // Import resources if they already exist
    await importIamRoleIfExists(featureName);
    await importLambdaIfExists(featureName, functionName);

    console.log(`Planning deployment for '${functionName}'...`);
    await runCmd('terraform', [
        'plan',
        `-target=aws_lambda_function.${functionName}`,
        `-var=feature_name=${featureName}`,
        '-out=tfplan'
    ], { cwd: TERRAFORM_DIR });

    console.log('Applying Terraform plan...');
    await runCmd('terraform', ['apply', '-auto-approve', 'tfplan'], { cwd: TERRAFORM_DIR });
}

// Invoke the Lambda function via AWS CLI
async function invokeLambda(featureName, functionName, payloadFile, outputFile) {
    const awsFunctionName = `${featureName}-${functionName}`;
    console.log(`Invoking Lambda function '${awsFunctionName}' using payload '${payloadFile}'...`);

    return new Promise((resolve, reject) => {
        const args = [
            'lambda', 'invoke',
            '--function-name', awsFunctionName,
            '--payload', `file://${payloadFile}`,
            outputFile,
            '--cli-binary-format', 'raw-in-base64-out',
            '--log-type', 'Tail',
            '--query', 'LogResult',
            '--output', 'text'
        ];
        const child = spawn('aws', args, { shell: true });
        let logResult = '';
        child.stdout.on('data', (data) => { logResult += data.toString(); });
        child.stderr.on('data', (data) => { console.error(data.toString()); });
        child.on('close', (code) => {
            if (code !== 0) {
                reject(new Error('Error invoking Lambda function'));
            } else {
                resolve(logResult.trim());
            }
        });
    });
}

// Main async function
(async () => {
    // Parse arguments: either [feature_name, function_logical_id, payload, output] or just [function_logical_id, ...]
    const args = process.argv.slice(2);
    let featureName, functionName, payloadFile, outputFile;
    if (args.length >= 2) {
        featureName = args[0];
        functionName = args[1];
        payloadFile = args[2] || 'payload.json';
        outputFile = args[3] || 'output.json';
    } else if (args.length === 1) {
        try {
            featureName = await getLocalGitBranch();
        } catch (err) {
            console.error('Error detecting Git branch:', err.message);
            process.exit(1);
        }
        functionName = args[0];
        payloadFile = 'payload.json';
        outputFile = 'output.json';
    } else {
        console.error("Usage: node invoke_and_deploy.js [<feature_name>] <function_logical_id> [<payload_file>] [<output_file>]");
        process.exit(1);
    }

    console.log(`Feature: ${featureName}, Function: ${functionName}`);

    try {
        // Build and deploy the function
        await buildAndDeployFunction(featureName, functionName);

        // Invoke the deployed Lambda function
        const logResult = await invokeLambda(featureName, functionName, payloadFile, outputFile);
        console.log(`Lambda invocation complete. Response saved to '${outputFile}'.`);

        // Decode base64 logs (CloudWatch Logs come back as base64)
        try {
            const decodedLogs = Buffer.from(logResult, 'base64').toString('utf8');
            console.log("CloudWatch Logs:");
            console.log(decodedLogs);
        } catch (e) {
            console.log("Raw log output:");
            console.log(logResult);
        }
    } catch (err) {
        console.error("Error during build/deploy/invoke process:", err.message);
        process.exit(1);
    }
})();
