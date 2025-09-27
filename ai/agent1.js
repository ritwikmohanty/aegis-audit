import 'dotenv/config';
import { exec } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { Client, PrivateKey, TopicMessageSubmitTransaction, TopicId } from '@hashgraph/sdk';

// --- Helper Functions ---

/**
 * Creates and configures a Hedera client.
 */
function createClient() {
    const accountId = process.env.HEDERA_ACCOUNT_ID;
    const privateKeyStr = process.env.HEDERA_PRIVATE_KEY;

    if (!accountId || !privateKeyStr) {
        throw new Error("HEDERA_ACCOUNT_ID and HEDERA_PRIVATE_KEY must be set in your .env file");
    }

    try {
        return Client.forTestnet().setOperator(accountId, PrivateKey.fromString(privateKeyStr));
    } catch (error) {
        throw new Error("Invalid HEDERA_PRIVATE_KEY format.");
    }
}

/**
 * Submits a log message to a specific HCS topic.
 * @param {Client} client The Hedera client.
 * @param {string} topicId The HCS topic ID for logging.
 * @param {string} message The log message.
 * @param {string} runId The unique ID for the audit run.
 */
async function logToHcs(client, topicId, message, runId) {
    const logMessage = `[Agent 1][${runId}] ${message}`;
    
    // In test mode, just log to console instead of HCS
    if (process.env.TEST_MODE === 'true' || !topicId || topicId === '0.0.789012') {
        console.log(`[TEST MODE] ${logMessage}`);
        return;
    }
    
    try {
        await new TopicMessageSubmitTransaction({
            topicId: TopicId.fromString(topicId),
            message: logMessage,
        }).execute(client);
    } catch (error) {
        // Log to console if HCS fails, but don't stop the script
        console.error(`[HCS LOG FAILED] ${error.message}`);
    }
}

/**
 * Runs a command-line command in a promise-based way.
 * @param {string} command The command to execute.
 * @returns {Promise<{stdout: string, stderr: string}>}
 */
function runCommand(command) {
    return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
            if (error) {
                // Slither exits with an error code on success, so we don't reject here
                // but we will check for the output file's existence later.
            }
            resolve({ stdout, stderr });
        });
    });
}

// --- Main Agent Logic ---

async function main() {
    const [targetPath, runId] = process.argv.slice(2);
    if (!targetPath || !runId) {
        console.error("Usage: node agent1.js <contract_path_or_url> <run_id>");
        process.exit(1);
    }

    const client = createClient();
    const logTopicId = process.env.AGENT1_LOG_TOPIC_ID;

    await logToHcs(client, logTopicId, `Initializing analysis for ${targetPath}`, runId);

    // 1. Prepare Contract Code (local file or URL)
    const workDir = '/tmp/aegis_runs';
    await fs.mkdir(workDir, { recursive: true });
    const localPath = path.join(workDir, `contract_${runId}.sol`);
    
    if (targetPath.startsWith('http')) {
        // Fetch from URL
        await logToHcs(client, logTopicId, "Fetching contract code from URL...", runId);
        await runCommand(`curl -s -o ${localPath} ${targetPath}`);
    } else {
        // Copy local file
        await logToHcs(client, logTopicId, "Copying local contract file...", runId);
        await fs.copyFile(targetPath, localPath);
    }

    // 2. Run Slither Analysis
    const reportPath = path.join(workDir, `report_${runId}.json`);
    await logToHcs(client, logTopicId, "Executing Slither analysis...", runId);
    await runCommand(`slither ${localPath} --json ${reportPath}`);

    // 3. Read and Process the Report
    let findings = [];
    try {
        const reportContent = await fs.readFile(reportPath, 'utf8');
        const report = JSON.parse(reportContent);
        findings = report.results?.detectors || [];
        await logToHcs(client, logTopicId, `Slither analysis complete. Found ${findings.length} potential issues.`, runId);
    } catch (error) {
        await logToHcs(client, logTopicId, "FATAL: Slither failed to produce a valid report.", runId);
        console.error("Slither analysis failed:", error.message);
        process.exit(1);
    }

    // 4. Clean up temporary files
    await fs.unlink(localPath);
    await fs.unlink(reportPath);

    // 5. Final Output
    // Print the clean JSON to stdout for the Master Agent to capture.
    console.log(JSON.stringify(findings, null, 2));

    client.close();
}

main().catch((error) => {
    console.error("Agent 1 failed with an unhandled error:", error.message);
    process.exit(1);
});
