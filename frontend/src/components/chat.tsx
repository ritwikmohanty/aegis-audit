import { LoaderCircle } from 'lucide-react';
import { EmptyChat } from '@/components/empty-chat';
import { ChatMessage } from '@/shared/types';

type ChatProps = {
  isLoading: boolean;
  chatHistory: ChatMessage[];
};

export function Chat({ chatHistory, isLoading }: ChatProps) {
  return (
    <div className="bg-zinc-800 grow rounded-lg flex flex-col gap-2 p-4">
      {chatHistory.map((message, idx) => (
        <div key={idx} className="flex">
          {message.type === 'human' ? (
            <div className="bg-zinc-700 inline-block px-4 py-2 rounded-md ml-auto">
              {message.content}
            </div>
          ) : (
            <div className="bg-zinc-700 inline-block px-4 py-2 rounded-md break-all">
              {message.content}
            </div>
          )}
        </div>
      ))}

      {isLoading && (
        <div>
          <div className="bg-zinc-700 inline-block px-4 py-2 rounded-md">
            <LoaderCircle className="animate-spin" />
          </div>
        </div>
      )}

      <EmptyChat isChatEmpty={chatHistory.length <= 0} />
    </div>
  );
}
