'use client';

import { ChatMessage } from '@/shared/types';
import { useState, useEffect } from 'react';
import { useHandleChat } from '@/lib/handle-chat';
import { ChatInput } from '@/components/chat-input';
import { Header } from '@/components/header';
import { useDAppConnector } from '@/components/client-providers';
import { Chat } from '@/components/chat';

export default function Home() {
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [prompt, setPrompt] = useState('');
  const { mutateAsync, isPending } = useHandleChat();

  const { dAppConnector } = useDAppConnector();

  async function handleUserMessage() {
    const currentPrompt = prompt;
    setPrompt('');

    setChatHistory((v) => [
      ...v,
      {
        type: 'human',
        content: currentPrompt,
      },
    ]);

    const agentResponse = await mutateAsync({
      userAccountId: dAppConnector?.signers[0].getAccountId().toString() ?? '',
      input: currentPrompt,
      history: chatHistory,
    });

    setChatHistory((v) => [
      ...v,
      {
        type: 'ai',
        content: agentResponse.message,
      },
    ]);

    if (agentResponse.transactionBytes) {
      const result = await dAppConnector?.signAndExecuteTransaction({
        signerAccountId: dAppConnector?.signers[0].getAccountId().toString() ?? '',
        transactionList: agentResponse.transactionBytes,
      });
      const transactionId = 'transactionId' in result ? result.transactionId : null;

      setChatHistory((v) => [
        ...v,
        {
          type: 'ai',
          content: `Transaction signed and executed sucessfully, txId: ${transactionId}`,
        },
      ]);
    }
  }

  return (
    <div className="h-screen w-full bg-red-400 flex items-center justify-center flex-col">
      <main className="w-4xl h-full flex flex-col">
        <Header />

        <Chat chatHistory={chatHistory} isLoading={isPending} />

        <ChatInput
          handleUserMessage={handleUserMessage}
          prompt={prompt}
          setPrompt={setPrompt}
          isPending={isPending}
        />
      </main>
    </div>
  );
}
