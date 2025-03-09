#!/usr/bin/env node

// Usage: npm run watch-lambda -- myFunction
// Example: npm run watch-lambda -- myNewFunction
//
// This script:
//  1) Auto-detects your local Git branch (e.g. feature/test -> feature-test)
//  2) Watches "functions/<functionName>" for file changes (ignores initial triggers)
//  3) On each change:
//     a) Imports the IAM role (lambda-exec-role-<branch>) if it exists
//     b) Imports the Lambda function (<branch>-<functionName>) if it exists
//     c) Rebuilds just that function (PowerShell script on Windows)
//     d) terraform init -> partial plan -> partial apply
//  4) Minimizes overhead by focusing on a single resource
//  5) Includes debug logs to help diagnose issues

console.log("DEBUG: Script loaded and starting...");

const chokidar = require('chokidar');
const { spawn } = require('child_process');
const path = require('path');

console.log("DEBUG: Imported modules: chokidar, child_process, path.");

// 1) Parse the function name from arguments
const [, , FUNCTION_NAME] = process.argv;
console.log("DEBUG: Parsed FUNCTION_NAME =", FUNCTION_NAME);

if (!FUNCTION_NAME) {
    console.error("Usage: npm run watch-lambda -- <FUNCTION_NAME>");
    process.exit(1);
}

// Helper: run a command and return a Promise
function runCmd(cmd, args, options = {}) {
    return new Promise((resolve, reject) => {
        console.log(`DEBUG: Spawning command: ${cmd} ${args.join(' ')}`);
        const child = spawn(cmd, args, { stdio: 'inherit', shell: true, ...options });

        child.on('error', (err) => {
            console.error(`ERROR: Could not spawn ${cmd} ${args.join(' ')}:`, err);
            reject(err);
        });

        child.on('close', (code) => {
            console.log(`DEBUG: Command '${cmd} ${args.join(' ')}' closed with code ${code}`);
            if (code !== 0) {
                reject(new Error(`${cmd} failed with code ${code}`));
            } else {
                resolve();
            }
        });
    });
}

// 2) Get local Git branch, replace slashes with dashes
function getLocalGitBranch() {
    console.log("DEBUG: Inside getLocalGitBranch, about to spawn git rev-parse...");

    return new Promise((resolve, reject) => {
        const child = spawn('git', ['rev-parse', '--abbrev-ref', 'HEAD']);

        child.on('error', (err) => {
            console.error("ERROR: Could not spawn git rev-parse:", err);
            reject(err);
        });

        let output = '';

        child.stdout.on('data', (data) => {
            console.log("DEBUG: git rev-parse stdout chunk:", data.toString().trim());
            output += data.toString();
        });

        child.stderr.on('data', (errData) => {
            console.log("DEBUG: git rev-parse stderr chunk:", errData.toString().trim());
        });

        child.on('close', (code) => {
            console.log("DEBUG: git rev-parse exit code =", code, "combined output=", output.trim());
            if (code === 0) {
                const branch = output.trim().replace(/\//g, '-');
                resolve(branch);
            } else {
                reject(new Error('Failed to detect local Git branch'));
            }
        });
    });
}

// 3A) Check & Import IAM Role if it exists
async function importIamRoleIfExists(featureName) {
    const roleName = `lambda-exec-role-${featureName}`;
    console.log(`DEBUG: Checking if IAM role '${roleName}' exists...`);

    return new Promise((resolve) => {
        const child = spawn('aws', ['iam', 'get-role', '--role-name', roleName]);
        let stderrOut = '';

        child.stderr.on('data', (d) => { stderrOut += d.toString(); });

        child.on('error', (err) => {
            console.error("ERROR: Could not spawn aws iam get-role:", err);
        });

        child.on('close', (code) => {
            console.log(`DEBUG: aws iam get-role closed with code ${code}`);
            if (code === 0) {
                console.log(`Role '${roleName}' found. Importing into Terraform state...`);
                runCmd('terraform', ['import', 'aws_iam_role.lambda_exec_role', roleName], { cwd: 'terraform' })
                    .then(() => resolve())
                    .catch((err) => {
                        console.log("DEBUG: terraform import errored, ignoring if it's 'already managed' =>", err.message);
                        resolve();
                    });
            } else {
                console.log(`Role '${roleName}' does not exist or error.\n${stderrOut}`);
                resolve(); // let Terraform create it if needed
            }
        });
    });
}

// 3B) Check & Import the Lambda function if it exists
async function importLambdaIfExists(featureName, functionName) {
    const awsName = `${featureName}-${functionName}`;
    console.log(`DEBUG: Checking if Lambda function '${awsName}' exists...`);

    return new Promise((resolve) => {
        const child = spawn('aws', ['lambda', 'get-function', '--function-name', awsName]);
        let stderrOut = '';

        child.stderr.on('data', (d) => { stderrOut += d.toString(); });

        child.on('error', (err) => {
            console.error("ERROR: Could not spawn aws lambda get-function:", err);
        });

        child.on('close', (code) => {
            console.log(`DEBUG: aws lambda get-function closed with code ${code}`);
            if (code === 0) {
                console.log(`Lambda function '${awsName}' found. Importing into Terraform state...`);
                runCmd('terraform', [
                    'import',
                    `aws_lambda_function.${functionName}`,
                    awsName
                ], { cwd: 'terraform' })
                    .then(() => resolve())
                    .catch((err) => {
                        console.log("DEBUG: terraform import errored, ignoring if 'already managed' =>", err.message);
                        resolve();
                    });
            } else {
                console.log(`Lambda '${awsName}' does not exist or error.\n${stderrOut}`);
                resolve(); // let Terraform create it if needed
            }
        });
    });
}

(async () => {
    console.log("DEBUG: Entering async main function...");

    // 4) Determine the feature/branch name
    let FEATURE_NAME;
    try {
        FEATURE_NAME = await getLocalGitBranch();
        console.log("DEBUG: Determined FEATURE_NAME =", FEATURE_NAME);
    } catch (err) {
        console.error("Could not determine Git branch:", err.message);
        process.exit(1);
    }

    console.log(`Detected Git branch: ${FEATURE_NAME}`);

    const FUNCTION_DIR = path.join('functions', FUNCTION_NAME);
    // For Windows: PowerShell build script
    const BUILD_SCRIPT = path.join('bin', 'powershell', 'build_single_function.ps1');
    const TERRAFORM_DIR = 'terraform';

    console.log(`Watching folder: ${FUNCTION_DIR}`);
    console.log(`Function name: ${FUNCTION_NAME}, feature name: ${FEATURE_NAME}`);

    // 5) Create the file watcher
    const watcher = chokidar.watch(FUNCTION_DIR, {
        ignored: /(^|[\/\\])\../,
        persistent: true,
        ignoreInitial: true
    });

    console.log(`\nNow watching ${FUNCTION_DIR} for changes. Press Ctrl+C to stop.\n`);

    // 6) On file change => import resources, rebuild, init, plan, apply
    watcher.on('change', async (filePath) => {
        console.log(`\nDetected change in ${filePath}. Rebuilding & applying...`);

        try {
            // A) Import the IAM role if it exists
            await importIamRoleIfExists(FEATURE_NAME);

            // B) Import the Lambda function if it exists
            await importLambdaIfExists(FEATURE_NAME, FUNCTION_NAME);

            // C) Rebuild the single function
            await runCmd('powershell', [
                '-File',
                BUILD_SCRIPT,
                FUNCTION_NAME
            ]);

            // D) terraform init
            await runCmd('terraform', ['init'], { cwd: TERRAFORM_DIR });

            // E) partial plan
            await runCmd('terraform', [
                'plan',
                `-target=aws_lambda_function.${FUNCTION_NAME}`,
                `-var=feature_name=${FEATURE_NAME}`,
                '-out=tfplan'
            ], { cwd: TERRAFORM_DIR });

            // F) partial apply
            await runCmd('terraform', ['apply', '-auto-approve', 'tfplan'], { cwd: TERRAFORM_DIR });

            console.log(`\n=== Successfully updated ${FUNCTION_NAME} on branch ${FEATURE_NAME}. Waiting for more changes...`);

        } catch (err) {
            console.error("ERROR during watch-lambda steps:", err.message);
        }
    });
})();

console.log("DEBUG: Reached end of script file (async function should be running).");
