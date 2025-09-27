import { WalletButton } from '@/components/wallet-button';
import { PriceDisplay } from '@/components/price-display';
import { usePythPriceService } from '@/hooks/use-pyth-price';

export function Header() {
  const { isInitialized, error } = usePythPriceService();

  return (
    <div className="border-b border-zinc-700">
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex justify-between items-center py-4 w-full">
          <div className="flex items-center space-x-6">
            <h1 className="text-2xl font-bold text-white">Aegis Audit</h1>
            {isInitialized && !error && (
              <PriceDisplay showConfidence={false} showLastUpdate={false} />
            )}
          </div>
          <WalletButton />
        </div>
      </div>
    </div>
  );
}
