'use client';

import { useDAppConnector } from './client-providers';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Wallet, LogOut, ChevronDown, Copy, Check } from 'lucide-react';
import { useState } from 'react';

export function WalletButton() {
  const { dAppConnector, userAccountId, disconnect, refresh } = useDAppConnector() ?? {};
  const [copied, setCopied] = useState(false);

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

  const handleCopyAddress = async () => {
    if (userAccountId) {
      await navigator.clipboard.writeText(userAccountId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!userAccountId) {
    return (
      <Button
        variant="outline"
        className="rounded-md bg-transparent"
        onClick={handleLogin}
        disabled={!dAppConnector}
      >
        <Wallet className="size-4 mr-2" />
        Connect Wallet
      </Button>
    );
  }

  const shortAddress = userAccountId.length > 15 
    ? `${userAccountId.slice(0, 6)}...${userAccountId.slice(-4)}` 
    : userAccountId;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="rounded-md bg-transparent"
          disabled={!dAppConnector}
        >
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="rounded-sm px-1 py-0 text-xs">
              HBAR
            </Badge>
            <span>{shortAddress}</span>
            <ChevronDown className="size-4 opacity-80" />
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <div className="px-3 py-2 text-sm">
          <div className="font-medium">Connected Account</div>
          <div className="text-muted-foreground">{userAccountId}</div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleCopyAddress}>
          {copied ? (
            <Check className="size-4 mr-2" />
          ) : (
            <Copy className="size-4 mr-2" />
          )}
          {copied ? 'Copied!' : 'Copy Address'}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleDisconnect} className="text-destructive">
          <LogOut className="size-4 mr-2" />
          Disconnect
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
