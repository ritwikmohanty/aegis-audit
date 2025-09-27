'use client';

import { ReactNode, useEffect, useState, createContext, useContext } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  HederaSessionEvent,
  HederaJsonRpcMethod,
  DAppConnector,
  HederaChainId,
} from '@hashgraph/hedera-wallet-connect';
import { LedgerId } from '@hashgraph/sdk';

const projectId = process.env.NEXT_PUBLIC_WALLET_CONNECT_ID ?? '';
const queryClient = new QueryClient();

const metadata = {
  name: 'AgentKit Next.js Demo',
  description: 'AgentKit Next.js Demo',
  url: 'https://example.com',
  icons: ['https://avatars.githubusercontent.com/u/179229932'],
};

type DAppConnectorContext = {
  dAppConnector: DAppConnector | null;
  userAccountId: string | null;
  sessionTopic: string | null;
  disconnect: (() => Promise<void>) | null;
  refresh: (() => void) | null;
};

const DAppConnectorContext = createContext<DAppConnectorContext | null>(null);
export const useDAppConnector = () => useContext(DAppConnectorContext);

type ClientProvidersProps = {
  children: ReactNode;
};

export function ClientProviders({ children }: ClientProvidersProps) {
  const [dAppConnector, setDAppConnector] = useState<DAppConnector | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [userAccountId, setUserAccountId] = useState<string | null>(null);
  const [sessionTopic, setSessionTopic] = useState<string | null>(null);

  // Listen for account/session changes using events$
  useEffect(() => {
    if (!dAppConnector) return;
    const subscription = (dAppConnector as any).events$?.subscribe((event: { name: string; data: any }) => {
      if (event.name === 'accountsChanged' || event.name === 'chainChanged') {
        setUserAccountId(dAppConnector.signers?.[0]?.getAccountId().toString() ?? null);
        // Try to get topic from event data
        if (event.data && event.data.topic) {
          setSessionTopic(event.data.topic);
        } else if (dAppConnector.signers?.[0]?.topic) {
          setSessionTopic(dAppConnector.signers[0].topic);
        } else {
          setSessionTopic(null);
        }
      } else if (event.name === 'session_delete' || event.name === 'sessionDelete') {
        setUserAccountId(null);
        setSessionTopic(null);
      }
    });
    // Set initial state
    setUserAccountId(dAppConnector.signers?.[0]?.getAccountId().toString() ?? null);
    if (dAppConnector.signers?.[0]?.topic) setSessionTopic(dAppConnector.signers[0].topic);
    return () => subscription && subscription.unsubscribe();
  }, [dAppConnector]);

  // Provide a disconnect function
  const disconnect = async () => {
    if (dAppConnector && sessionTopic) {
      await dAppConnector.disconnect(sessionTopic);
      setUserAccountId(null);
      setSessionTopic(null);
    }
  };

  // Provide a refresh function
  const refresh = () => {
    if (dAppConnector) {
      setUserAccountId(dAppConnector.signers?.[0]?.getAccountId().toString() ?? null);
      setSessionTopic(dAppConnector.signers?.[0]?.topic ?? null);
    }
  };

  useEffect(() => {
    let isMounted = true;
    async function init() {
      const connector = new DAppConnector(
        metadata,
        LedgerId.TESTNET,
        projectId,
        Object.values(HederaJsonRpcMethod),
        [HederaSessionEvent.ChainChanged, HederaSessionEvent.AccountsChanged],
        [HederaChainId.Mainnet, HederaChainId.Testnet],
      );
      await connector.init();
      if (isMounted) {
        setDAppConnector(connector);
        setIsReady(true);
      }
    }
    init().catch(console.log);
    return () => {
      isMounted = false;
    };
  }, []);

  if (!isReady)
    return (
      <div style={{ color: 'white', textAlign: 'center', marginTop: '2rem' }}>
        Loading wallet...
      </div>
    );

  return (
    <DAppConnectorContext.Provider value={{ dAppConnector, userAccountId, sessionTopic, disconnect, refresh }}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </DAppConnectorContext.Provider>
  );
}
