export type ChatMessage = {
  type: 'human' | 'ai';
  content: string;
};

export type ChatRequest = {
  userAccountId: string;
  input: string;
  history: ChatMessage[];
};
