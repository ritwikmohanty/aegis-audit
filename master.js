import 'dotenv/config';
import { AgentExecutor, createToolCallingAgent } from 'langchain/agents';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { ChatGroq } from '@langchain/groq';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { exec } from 'child_process';
import { promisify } from 'util';
import { randomUUID } from 'crypto';
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

// --- Define the "Tool" for our Master Agent ---
const fullAuditTool = new DynamicStructuredTool({
  name: 'full_security_audit',
  description: 'Performs a comprehensive, multi-stage security audit on a Solidity smart contract. This is the primary tool for analyzing code.',
  schema: z.object({
    contractPath: z.string().describe('The relative path to the smart contract file to be audited.'),
  }),
  func: async ({ contractPath }) => runFullAuditPipeline(contractPath),
});

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
    // TODO: Implement Agent 3 when ready
    console.log(`\n[MASTER_AGENT][${runId}] Agent 3 not yet implemented. Skipping...`);
    
    // For now, return the Agent 2 report as the final result
    const agent2Report = JSON.parse(agent2Output);
    await submitLogToHCS(remediationTopicId, JSON.stringify(agent2Report, null, 2));
    console.log(`[MASTER_AGENT][${runId}] Analysis complete. Agent 2 report submitted to HCS.`);
    
    return `Full audit complete for ${contractPath}. Agent 1 and Agent 2 analysis has been submitted to HCS Topic ${remediationTopicId}.`;

  } catch (error) {
    console.error(`[MASTER_AGENT][${runId}] A critical error occurred during the audit:`, error);
    const errorMessage = `The audit failed for ${contractPath}. Error: ${error.message}`;
    await submitLogToHCS(analysisTopicId, `[RunID: ${runId}] FATAL ERROR: ${errorMessage}`);
    return errorMessage;
  }
}

// --- Main Execution Logic for the Master Agent ---
async function main() {
  const llm = new ChatGroq({ apiKey: process.env.GROQ_API_KEY, model: 'llama-3.1-8b-instant' });
  const tools = [fullAuditTool];

  const prompt = ChatPromptTemplate.fromMessages([
  ['system', `You are a master orchestrator for a smart contract security auditing system. 
  Your only job is to understand a user's request and trigger the correct analysis tool.
  You have one tool available: 'full_security_audit'.
  This tool requires a single parameter: 'contractPath'.
  When a user asks you to perform an audit, you MUST call the 'full_security_audit' tool and provide ONLY the 'contractPath' parameter extracted from the user's input. 
  Do not invent or include any other parameters.
  Do not attempt to search for information or use any other tools.
  Simply extract the contract path from the user's request and call the audit tool.`],
  ['human', '{input}'],
  ['placeholder', '{agent_scratchpad}'],
]);

  const agent = await createToolCallingAgent({ llm, tools, prompt });
  const agentExecutor = new AgentExecutor({ agent, tools });

  const userInput = process.argv[2];
  if (!userInput) {
    console.error("Please provide a user command, e.g., 'node master.js \"Run a full security audit on the file contracts/contracts/VulnerableBank.sol\"'");
    process.exit(1);
  }

  console.log(`[MASTER_AGENT] Received user request: "${userInput}"`);
  
  const result = await agentExecutor.invoke({ input: userInput });

  console.log('\n--- AUDIT COMPLETE ---');
  console.log(result.output);
  console.log('----------------------\n');
}

main();