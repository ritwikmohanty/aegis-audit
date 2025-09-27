'use client';

import { ChatMessage } from '@/shared/types';
import { useState, useEffect } from 'react';
import { useHandleChat } from '@/lib/handle-chat';
import { ChatInput } from '@/components/chat-input';
import { Header } from '@/components/header';
import { useDAppConnector } from '@/components/client-providers';
import { Chat } from '@/components/chat';
import { PredictionMarket } from '@/components/prediction-market';
import { Button } from '@/components/ui/button';
import { MessageSquare, TrendingUp } from 'lucide-react';

export default function Home() {
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [prompt, setPrompt] = useState('');
  const [activeTab, setActiveTab] = useState<'chat' | 'markets'>('markets');
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
    <div className="min-h-screen w-full bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900">
      <Header />
      
      {/* Tab Navigation */}
      <div className="border-b border-zinc-700">
        <div className="max-w-6xl mx-auto px-6">
          <nav className="flex space-x-8">
            <Button
              variant={activeTab === 'markets' ? 'default' : 'ghost'}
              onClick={() => setActiveTab('markets')}
              className={`flex items-center space-x-2 ${
                activeTab === 'markets' 
                  ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                  : 'text-gray-400 hover:text-white hover:bg-zinc-700'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              <span>Prediction Markets</span>
            </Button>
            <Button
              variant={activeTab === 'chat' ? 'default' : 'ghost'}
              onClick={() => setActiveTab('chat')}
              className={`flex items-center space-x-2 ${
                activeTab === 'chat' 
                  ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                  : 'text-gray-400 hover:text-white hover:bg-zinc-700'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              <span>AI Assistant</span>
            </Button>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1">
        {activeTab === 'markets' ? (
          <PredictionMarket contractAddress="0xe7f1725e7734ce288f8367e1bb143e90bb3f0512" />
        ) : (
          <div className="h-[calc(100vh-140px)] w-full flex items-center justify-center flex-col">
            <div className="w-4xl h-full flex flex-col max-w-4xl mx-auto">
              <Chat chatHistory={chatHistory} isLoading={isPending} />
              <ChatInput
                handleUserMessage={handleUserMessage}
                prompt={prompt}
                setPrompt={setPrompt}
                isPending={isPending}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
