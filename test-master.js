import 'dotenv/config';
import { randomUUID } from 'crypto';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { Client, TopicMessageSubmitTransaction, PrivateKey } from '@hashgraph/sdk';

const execPromise = promisify(exec);

// --- Hedera HCS Logging Helper ---
const hederaClient = Client.forTestnet().setOperator(
  process.env.HEDERA_ACCOUNT_ID, 
  PrivateKey.fromStringECDSA(process.env.HEDERA_PRIVATE_KEY)
);

async function submitLogToHCS(topicId, logMessage) {
  if (!topicId || !logMessage) return;
  try {
    await new TopicMessageSubmitTransaction({
      topicId: topicId,
      message: logMessage,
    }).execute(hederaClient);
    console.log(`[MASTER_AGENT] Successfully submitted log to HCS Topic ${topicId}`);
  } catch (error) {
    console.error(`[MASTER_AGENT] HCS log submission failed for topic ${topicId}:`, error);
  }
}

// This is the main function that orchestrates the entire pipeline
async function runFullAuditPipeline(contractPath) {
  const runId = randomUUID();
  console.log(`\n[MASTER_AGENT] Starting full audit for ${contractPath} with Run ID: ${runId}`);
  const reportsDir = 'reports';
  await fs.mkdir(reportsDir, { recursive: true });

  const analysisTopicId = process.env.ANALYSIS_RESULTS_TOPIC_ID;
  const remediationTopicId = process.env.REMEDIATION_RESULTS_TOPIC_ID;

  try {
    // --- Step 1: Run Agent 1 (Static Analysis) ---
    console.log(`\n[MASTER_AGENT][${runId}] Executing Agent 1: Static Analyzer...`);
    const agent1ReportPath = path.join(reportsDir, `${runId}_agent1_output.json`);
    const agent1Command = `node ai/agent1.js ${contractPath} ${runId}`;
    const { stdout: agent1Output, stderr: agent1Logs } = await execPromise(agent1Command);
    await fs.writeFile(agent1ReportPath, agent1Output); // Save the clean JSON output
    console.log(agent1Logs); // Display logs from Agent 1
    await submitLogToHCS(analysisTopicId, `[RunID: ${runId}] Agent 1 Logs:\n${agent1Logs}`);
    console.log(`[MASTER_AGENT][${runId}] Agent 1 finished. Report saved to ${agent1ReportPath}`);

    // --- Step 2: Run Agent 2 (Symbolic & ML Analysis) ---
    console.log(`\n[MASTER_AGENT][${runId}] Executing Agent 2: Symbolic & ML Analyzer...`);
    const agent2ReportPath = path.join(reportsDir, `${runId}_agent2_output.json`);
    const agent2Command = `python3 ai/agent2.py ${contractPath} ${agent1ReportPath} ${runId}`;
    const { stdout: agent2Output, stderr: agent2Logs } = await execPromise(agent2Command);
    await fs.writeFile(agent2ReportPath, agent2Output); // Save the clean JSON output
    console.log(agent2Logs); // Display logs from the Python agent
    await submitLogToHCS(analysisTopicId, `[RunID: ${runId}] Agent 2 Logs:\n${agent2Logs}`);
    console.log(`[MASTER_AGENT][${runId}] Agent 2 finished. Report saved to ${agent2ReportPath}`);

    // --- Step 3: Run Agent 3 (AI Remediation) ---
    console.log(`\n[MASTER_AGENT][${runId}] Running Agent 3 (Remediation Agent)...`);
    const agent3ReportPath = path.join(reportsDir, `${runId}_agent3_output.json`);
    
    const agent3Command = `python3 ai/agent3.py ${contractPath} ${agent2ReportPath} ${runId}`;
    const { stdout: agent3Output, stderr: agent3Logs } = await execPromise(agent3Command);
    await fs.writeFile(agent3ReportPath, agent3Output); // Save the clean JSON output
    console.log(agent3Logs); // Display logs from the Python agent
    await submitLogToHCS(analysisTopicId, `[RunID: ${runId}] Agent 3 Logs:\n${agent3Logs}`);
    console.log(`[MASTER_AGENT][${runId}] Agent 3 finished. Report saved to ${agent3ReportPath}`);
    
    // Submit final remediation report to HCS
    const agent3Report = JSON.parse(agent3Output);
    await submitLogToHCS(remediationTopicId, JSON.stringify(agent3Report, null, 2));
    console.log(`[MASTER_AGENT][${runId}] Analysis complete. Full audit with remediation submitted to HCS.`);
    
    return `Full audit complete for ${contractPath}. Agent 1, Agent 2, and Agent 3 analysis with ${agent3Report.total_remediations || 0} remediations has been submitted to HCS Topic ${remediationTopicId}.`;

  } catch (error) {
    console.error(`[MASTER_AGENT][${runId}] A critical error occurred during the audit:`, error);
    const errorMessage = `The audit failed for ${contractPath}. Error: ${error.message}`;
    await submitLogToHCS(analysisTopicId, `[RunID: ${runId}] FATAL ERROR: ${errorMessage}`);
    return errorMessage;
  }
}

// Test the pipeline directly
async function main() {
  const contractPath = process.argv[2] || 'ai/minimal-secure-contract.sol';
  console.log(`[TEST] Testing master pipeline with contract: ${contractPath}`);
  
  try {
    const result = await runFullAuditPipeline(contractPath);
    console.log('\n--- AUDIT COMPLETE ---');
    console.log(result);
    console.log('----------------------\n');
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

main();