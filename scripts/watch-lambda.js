#!/usr/bin/env node

// Usage: npm run watch-lambda -- myFunction
// Example: npm run watch-lambda -- myNewFunction

const chokidar = require('chokidar');
const { spawn } = require('child_process');
const path = require('path');

// 1) Parse function name from arguments
const [, , FUNCTION_NAME] = process.argv;
if (!FUNCTION_NAME) {
    console.error("Usage: npm run watch-lambda -- <FUNCTION_NAME>");
    process.exit(1);
}

// 2) Helper function to get the local Git branch name
//    and convert slashes to dashes.
async function getLocalGitBranch() {
    return new Promise((resolve, reject) => {
        const child = spawn('git', ['rev-parse', '--abbrev-ref', 'HEAD']);
        let output = '';

        child.stdout.on('data', (data) => {
            output += data.toString();
        });

        child.stderr.on('data', (errData) => {
            // optional: capture error output
        });

        child.on('close', (code) => {
            if (code === 0) {
                const branch = output.trim().replace(/\//g, '-');
                resolve(branch);
            } else {
                reject(new Error('Failed to detect local Git branch'));
            }
        });
    });
}

(async () => {
    // 3) Determine branch name automatically
    let FEATURE_NAME;
    try {
        FEATURE_NAME = await getLocalGitBranch();
    } catch (err) {
        console.error("Could not determine Git branch:", err.message);
        process.exit(1);
    }

    console.log(`Detected Git branch: ${FEATURE_NAME}`);

    // 4) Paths
    const FUNCTION_DIR = path.join('functions', FUNCTION_NAME);
    const BUILD_SCRIPT = path.join('bin', 'bash', 'build_single_function.sh');
    const TERRAFORM_DIR = 'terraform';

    // Confirm we have everything
    console.log(`Watching folder: ${FUNCTION_DIR}`);
    console.log(`Function name: ${FUNCTION_NAME}, feature name: ${FEATURE_NAME}`);

    // 5) Create the file watcher
    const watcher = chokidar.watch(FUNCTION_DIR, {
        ignored: /(^|[\/\\])\../, // ignore dotfiles
        persistent: true
    });

    console.log(`\nNow watching ${FUNCTION_DIR} for changes. Press Ctrl+C to stop.\n`);

    // 6) On any change, rebuild & partial apply
    watcher.on('all', (event, filePath) => {
        console.log(`\nDetected change in ${filePath}. Rebuilding & applying...`);

        // 6A) Rebuild the single function
        const build = spawn('bash', [BUILD_SCRIPT, FUNCTION_NAME], { stdio: 'inherit' });

        build.on('close', (buildCode) => {
            if (buildCode !== 0) {
                console.error(`Build script failed with exit code ${buildCode}`);
                return;
            }
            console.log(`Build script for ${FUNCTION_NAME} completed successfully.`);

            // 6B) Terraform plan & apply (partial)
            const plan = spawn('terraform', [
                'plan',
                `-target=aws_lambda_function.${FUNCTION_NAME}`,
                `-var=feature_name=${FEATURE_NAME}`,
                '-out=tfplan'
            ], {
                cwd: TERRAFORM_DIR,
                stdio: 'inherit'
            });

            plan.on('close', (planCode) => {
                if (planCode !== 0) {
                    console.error(`Terraform plan failed with code ${planCode}`);
                    return;
                }
                // Apply
                const apply = spawn('terraform', ['apply', '-auto-approve', 'tfplan'], {
                    cwd: TERRAFORM_DIR,
                    stdio: 'inherit'
                });
                apply.on('close', (applyCode) => {
                    if (applyCode !== 0) {
                        console.error(`Terraform apply failed with code ${applyCode}`);
                    } else {
                        console.log(`\n=== Successfully updated ${FUNCTION_NAME} on branch ${FEATURE_NAME}. Waiting for more changes...`);
                    }
                });
            });
        });
    });
})();
