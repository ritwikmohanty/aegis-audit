import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { ChatRequest } from '@/shared/types';

const chatResponseSchema = z.object({
  message: z.string(),
  transactionBytes: z.string().optional(),
});

export async function handleChatRequest(body: ChatRequest) {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const rawData = await response.json();
  return chatResponseSchema.parse(rawData);
}

export function useHandleChat() {
  return useMutation({
    mutationKey: ['handle-ai-chat'],
    mutationFn: (data: ChatRequest) => handleChatRequest(data),
  });
}
