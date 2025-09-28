#!/usr/bin/env node
import { exec } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * Prints a structured log message to the standard error stream for the Master Agent to capture.
 * @param {string} message The log message.
 * @param {string} runId The unique ID for the audit run.
 */
function log(message, runId) {
    // We log to stderr to keep stdout clean for the final JSON result.
    const logMessage = `[Agent 1][${runId}] ${message}`;
    console.error(logMessage);
}

/**
 * Runs a command-line command in a promise-based way.
 * @param {string} command The command to execute.
 * @returns {Promise<{stdout: string, stderr: string}>}
 */
function runCommand(command) {
    return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
            // Don't reject on error, as Slither exits with non-zero codes on findings.
            // The calling function will check if the report file was created.
            resolve({ stdout, stderr });
        });
    });
}

// --- Main Agent Logic ---
async function main() {
    const [targetPath, runId] = process.argv.slice(2);
    if (!targetPath || !runId) {
        console.error("FATAL: Usage: node agent1.js <contract_path_or_url> <run_id>");
        process.exit(1);
    }

    log(`Initializing analysis for ${targetPath}`, runId);

    // 1. Prepare Contract Code
    const workDir = '/tmp/aegis_runs';
    await fs.mkdir(workDir, { recursive: true });
    const localPath = path.join(workDir, `contract_${runId}.sol`);
    
    if (targetPath.startsWith('http')) {
        log("Fetching contract code from URL...", runId);
        await runCommand(`curl -s -o ${localPath} ${targetPath}`);
    } else {
        log("Copying local contract file...", runId);
        await fs.copyFile(targetPath, localPath);
    }

    // 2. Run Slither Analysis
    const reportPath = path.join(workDir, `report_${runId}.json`);
    log("Executing Slither analysis...", runId);
    await runCommand(`slither ${localPath} --json ${reportPath}`);

    // 3. Read and Process the Report
    let findings = [];
    try {
        const reportContent = await fs.readFile(reportPath, 'utf8');
        const report = JSON.parse(reportContent);
        findings = report.results?.detectors || [];
        log(`Slither analysis complete. Found ${findings.length} potential issues.`, runId);
    } catch (error) {
        log("FATAL: Slither failed to produce a valid report.", runId);
        // This specific error should be printed to stderr so the master agent sees it.
        console.error("Slither analysis failed:", error.message);
        process.exit(1);
    }

    // 4. Clean up temporary files
    await fs.unlink(localPath);
    await fs.unlink(reportPath);

    // 5. Final Output
    // Print the clean JSON array to stdout for the Master Agent to capture.
    console.log(JSON.stringify(findings, null, 2));
}

main().catch((error) => {
    // This will catch any other unhandled errors and report them.
    console.error("Agent 1 failed with an unhandled error:", error.message);
    process.exit(1);
});