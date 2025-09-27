'use client';

import { useDAppConnector } from './client-providers';

export function WalletButton() {
  const { dAppConnector, userAccountId, disconnect, refresh } = useDAppConnector() ?? {};

  const handleLogin = async () => {
    if (dAppConnector) {
      await dAppConnector.openModal();
      if (refresh) refresh();
    }
  };

  const handleDisconnect = () => {
    if (disconnect) {
      void disconnect();
    }
  };

  if (!userAccountId) {
    return (
      <button
        className="truncate bg-zinc-600 py-1 px-4 rounded-md cursor-pointer"
        onClick={handleLogin}
        disabled={!dAppConnector}
      >
        Log in
      </button>
    );
  }

  return (
    <button
      className="truncate bg-zinc-600 py-1 px-4 rounded-md cursor-pointer"
      onClick={handleDisconnect}
      disabled={!dAppConnector}
    >
      {`Disconnect (${userAccountId})`}
    </button>
  );
}
