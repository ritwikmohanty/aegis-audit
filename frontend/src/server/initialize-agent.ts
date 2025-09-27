import { Client } from '@hashgraph/sdk';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { ChatOpenAI } from '@langchain/openai';
import { AgentMode, HederaLangchainToolkit } from 'hedera-agent-kit';
import { AgentExecutor, createToolCallingAgent } from 'langchain/agents';
import { BufferMemory } from 'langchain/memory';

export async function initializeAgent(userAccountId: string) {
  if (!userAccountId)
    throw new Error('userAccountId must be set');

  // Initialise OpenAI LLM
  const llm = new ChatOpenAI({
    model: 'gpt-4o-mini',
  });

  const agentClient = Client.forTestnet();

    // Prepare Hedera toolkit (load all tools by default)
    const hederaAgentToolkit = new HederaLangchainToolkit({
      client: agentClient,
      configuration: {
        tools: [], // use an empty array if you wantto load all tools
        context: {
          mode: AgentMode.RETURN_BYTES,
          accountId: userAccountId,
        },
      },
    });

    // Load the structured chat prompt template
    const prompt = ChatPromptTemplate.fromMessages([
      ['system', 'You are a helpful assistant'],
      ['placeholder', '{chat_history}'],
      ['human', '{input}'],
      ['placeholder', '{agent_scratchpad}'],
    ]);
  
  
  // Fetch tools from toolkit
  // cast to any to avoid excessively deep type instantiation caused by zod@3.25
  const tools = hederaAgentToolkit.getTools();

  // Create the underlying agent
  const agent = createToolCallingAgent({
    llm,
    tools,
    prompt,
  });

  // In-memory conversation history
  const memory = new BufferMemory({
    memoryKey: 'chat_history',
    inputKey: 'input',
    outputKey: 'output',
    returnMessages: true,
  });

  // Wrap everything in an executor that will maintain memory
  const agentExecutor = new AgentExecutor({
    agent,
    tools,
    memory,
    returnIntermediateSteps: true,
  }); 

  return agentExecutor;
}
