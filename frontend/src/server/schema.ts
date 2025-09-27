import { z } from 'zod';

export const chatHistoryMessageSchema = z.object({
  type: z.union([z.literal('human'), z.literal('ai')]),
  content: z.string(),
});

export const handleChatBodySchema = z.object({
  userAccountId: z.string(),
  input: z.string(),
  history: z.array(chatHistoryMessageSchema),
});
