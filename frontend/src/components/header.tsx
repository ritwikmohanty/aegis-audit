import { WalletButton } from '@/components/wallet-button';

export function Header() {
  return (
    <div className="flex justify-between py-4 w-full">
      <h1>Hedera Agent Kit Next.js Demo</h1>
      <WalletButton />
    </div>
  );
}
