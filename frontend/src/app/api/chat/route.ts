import { handleChatBodySchema } from '@/server/schema';
import { initializeAgent } from '@/server/initialize-agent';
import { NextRequest } from 'next/server';

export const runtime = 'nodejs';

type ResponseData = {
    message: string;
    transactionBytes?: string;
};

function extractBytesFromAgentResponse(response: any): any {
    if (
      response.intermediateSteps &&
      response.intermediateSteps.length > 0 &&
      response.intermediateSteps[0].observation
    ) {
      const obs = response.intermediateSteps[0].observation;
      try {
        const obsObj = typeof obs === 'string' ? JSON.parse(obs) : obs;
        if (obsObj.bytes) {
            const bytes = obsObj.bytes;
            const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes.data ?? bytes);
            return buffer.toString('base64');
        }
      } catch (e) {
        console.error('Error parsing observation:', e);
      }
    }
    return undefined;
  }

export async function POST(req: NextRequest) {
    const data = await req.json();
    const agentExecutor = await initializeAgent(data.userAccountId);
    const parsedBody = handleChatBodySchema.safeParse(data);
    if (!parsedBody.success) {
        return Response.json({ message: 'Invalid body request' });
    }

    const body = parsedBody.data;

    const agentResponse = await agentExecutor.invoke({
        input: body.input,
        chat_history: body.history,
    });
    const response: ResponseData = {
        message: agentResponse.output ?? '-',
    };

    response.transactionBytes = extractBytesFromAgentResponse(agentResponse);
    if (response.transactionBytes) {
        response.message = 'Sign transaction bytes';
    }

    return Response.json(response);
}