'use client';

import { useState, useEffect } from 'react';
import { useDAppConnector } from '@/components/client-providers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LoaderCircle, Plus, TrendingUp, TrendingDown, Clock, Users } from 'lucide-react';
import { useHBARPrice } from '@/hooks/use-pyth-price';
import { MarketPriceDisplay } from '@/components/price-display';
import { useHederaContracts, useMarkets } from '@/hooks/use-hedera-contracts';

interface Market {
  id: number;
  question: string;
  creator: string;
  endTime: number;
  status: 'Active' | 'Resolved' | 'Cancelled';
  outcome: 'Pending' | 'Yes' | 'No' | 'Invalid';
  yesTokenPool: string;
  noTokenPool: string;
  collateralPool: string;
  address?: string; // Contract address for the market
}

interface PredictionMarketProps {
  contractAddress: string;
}

export function PredictionMarket({ contractAddress }: PredictionMarketProps) {
  const [displayMarkets, setDisplayMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newMarket, setNewMarket] = useState({
    question: '',
    endTime: '',
    oracle: '',
  });
  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null);
  const [betAmount, setBetAmount] = useState('');
  const [betType, setBetType] = useState<'yes' | 'no'>('yes');

  const { dAppConnector, userAccountId } = useDAppConnector();
  const { convertHBARToUSD, convertUSDToHBAR, price: hbarPrice } = useHBARPrice();
  const { 
    createMarket, 
    placeBet, 
    transactionState, 
    resetTransactionState,
    hbarToTinybars,
    tinybarsToHbar 
  } = useHederaContracts();
  const { markets, isLoading: marketsLoading, loadMarkets } = useMarkets();

  // Load real markets from contract
  useEffect(() => {
    loadMarkets();
  }, [loadMarkets]);

  // Automatically populate oracle address from connected wallet
  useEffect(() => {
    if (userAccountId && !newMarket.oracle) {
      setNewMarket(prev => ({ ...prev, oracle: userAccountId }));
    }
  }, [userAccountId, newMarket.oracle]);

  // Convert contract markets to display format
  useEffect(() => {
    const convertedMarkets: Market[] = markets.map((market, index) => ({
      id: index,
      question: market.info.question,
      creator: market.info.oracle,
      endTime: market.info.endTime * 1000, // Convert to milliseconds
      status: market.info.isResolved ? 'Resolved' : 'Active',
      outcome: market.info.outcome === 0 ? 'Pending' : 
               market.info.outcome === 1 ? 'Yes' : 
               market.info.outcome === 2 ? 'No' : 'Invalid',
      yesTokenPool: tinybarsToHbar(market.info.totalYesShares).toFixed(2),
      noTokenPool: tinybarsToHbar(market.info.totalNoShares).toFixed(2),
      collateralPool: tinybarsToHbar(market.info.totalCollateral).toFixed(2),
      address: market.address, // Add contract address
    }));
    setDisplayMarkets(convertedMarkets);
  }, [markets]);

  const handleCreateMarket = async () => {
    if (!dAppConnector || !newMarket.question || !newMarket.endTime) return;

    resetTransactionState();
    
    try {
      const endTime = Math.floor(new Date(newMarket.endTime).getTime() / 1000); // Convert to seconds
      
      const result = await createMarket({
        question: newMarket.question,
        endTime,
        oracle: newMarket.oracle || dAppConnector.signers[0].getAccountId().toString(),
        yesSymbol: `YES_${Date.now()}`,
        noSymbol: `NO_${Date.now()}`,
      });

      if (result) {
        setShowCreateForm(false);
        setNewMarket({ question: '', endTime: '', oracle: '' });
        // Reload markets to show the new one
        await loadMarkets();
      }
    } catch (error) {
      console.error('Error creating market:', error);
    }
  };

  const handlePlaceBet = async (marketId: number) => {
    if (!dAppConnector || !betAmount) return;

    resetTransactionState();
    
    try {
      const market = displayMarkets.find(m => m.id === marketId);
      if (!market || !market.address) {
        throw new Error('Market not found');
      }

      const amountInTinybars = hbarToTinybars(parseFloat(betAmount));
      
      const result = await placeBet({
        marketAddress: market.address,
        isYesToken: betType === 'yes',
        amount: amountInTinybars,
      });

      if (result) {
        setBetAmount('');
        setSelectedMarket(null);
        // Reload markets to show updated pools
        await loadMarkets();
      }
    } catch (error) {
      console.error('Error placing bet:', error);
    }
  };

  const getMarketStatusColor = (status: string) => {
    switch (status) {
      case 'Active': return 'bg-green-500';
      case 'Resolved': return 'bg-blue-500';
      case 'Cancelled': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getTimeRemaining = (endTime: number) => {
    const now = Date.now();
    const remaining = endTime - now;
    
    if (remaining <= 0) return 'Ended';
    
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours}h ${minutes}m`;
  };

  const getYesOdds = (market: Market) => {
    const yes = parseFloat(market.yesTokenPool);
    const no = parseFloat(market.noTokenPool);
    const total = yes + no;
    return total > 0 ? (no / total * 100).toFixed(1) : '50.0';
  };

  const getNoOdds = (market: Market) => {
    const yes = parseFloat(market.yesTokenPool);
    const no = parseFloat(market.noTokenPool);
    const total = yes + no;
    return total > 0 ? (yes / total * 100).toFixed(1) : '50.0';
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white">Prediction Markets</h1>
          <p className="text-gray-400">Bet on future events and earn rewards</p>
        </div>
        <div className="flex items-center space-x-4">
          <MarketPriceDisplay />
          <Button 
            onClick={() => setShowCreateForm(true)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Market
          </Button>
        </div>
      </div>

      {/* Create Market Form */}
      {showCreateForm && (
        <Card className="bg-zinc-800 border-zinc-700">
          <CardHeader>
            <CardTitle className="text-white">Create New Market</CardTitle>
            <CardDescription className="text-gray-400">
              Create a prediction market for others to bet on
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Question
              </label>
              <Input
                value={newMarket.question}
                onChange={(e) => setNewMarket(prev => ({ ...prev, question: e.target.value }))}
                placeholder="e.g., Will HBAR reach $0.10 by end of 2024?"
                className="bg-zinc-700 border-zinc-600 text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                End Time
              </label>
              <Input
                type="datetime-local"
                value={newMarket.endTime}
                onChange={(e) => setNewMarket(prev => ({ ...prev, endTime: e.target.value }))}
                className="bg-zinc-700 border-zinc-600 text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Oracle Address
                {userAccountId && (
                  <span className="text-xs text-green-400 ml-2">
                    (Auto-filled from wallet)
                  </span>
                )}
              </label>
              <Input
                value={newMarket.oracle}
                onChange={(e) => setNewMarket(prev => ({ ...prev, oracle: e.target.value }))}
                placeholder={userAccountId ? userAccountId : "Oracle account ID (0.0.xxxxx)"}
                className="bg-zinc-700 border-zinc-600 text-white"
              />
              {userAccountId && newMarket.oracle === userAccountId && (
                <p className="text-xs text-gray-400 mt-1">
                  Using your connected wallet as oracle. You can change this if needed.
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={handleCreateMarket}
                disabled={transactionState.isLoading || !newMarket.question || !newMarket.endTime}
                className="bg-green-600 hover:bg-green-700"
              >
                {transactionState.isLoading && <LoaderCircle className="w-4 h-4 mr-2 animate-spin" />}
                Create Market
              </Button>
              <Button 
                variant="outline"
                onClick={() => setShowCreateForm(false)}
                className="border-zinc-600 text-gray-300 hover:bg-zinc-700"
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transaction Status */}
      {transactionState.error && (
        <Card className="bg-red-900/20 border-red-700">
          <CardContent className="p-4">
            <div className="text-red-400">
              <strong>Transaction Error:</strong> {transactionState.error}
            </div>
          </CardContent>
        </Card>
      )}

      {transactionState.txHash && (
        <Card className="bg-green-900/20 border-green-700">
          <CardContent className="p-4">
            <div className="text-green-400">
              <strong>Transaction Successful!</strong> 
              <a 
                href={`https://testnet.hashscan.io/transaction/${transactionState.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-2 underline hover:text-green-300"
              >
                View on Hashscan
              </a>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Markets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {displayMarkets.map((market) => (
          <Card key={market.id} className="bg-zinc-800 border-zinc-700 hover:border-zinc-600 transition-colors">
            <CardHeader>
              <div className="flex justify-between items-start">
                <Badge className={`${getMarketStatusColor(market.status)} text-white`}>
                  {market.status}
                </Badge>
                <div className="flex items-center text-gray-400 text-sm">
                  <Clock className="w-4 h-4 mr-1" />
                  {getTimeRemaining(market.endTime)}
                </div>
              </div>
              <CardTitle className="text-white text-lg leading-tight">
                {market.question}
              </CardTitle>
              <CardDescription className="text-gray-400">
                Created by {market.creator}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Odds Display */}
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-green-900/30 rounded-lg border border-green-700">
                  <div className="flex items-center justify-center mb-1">
                    <TrendingUp className="w-4 h-4 text-green-400 mr-1" />
                    <span className="text-green-400 font-semibold">YES</span>
                  </div>
                  <div className="text-2xl font-bold text-green-400">
                    {getYesOdds(market)}%
                  </div>
                  <div className="text-xs text-gray-400">
                    {market.yesTokenPool} HBAR
                  </div>
                </div>
                <div className="text-center p-3 bg-red-900/30 rounded-lg border border-red-700">
                  <div className="flex items-center justify-center mb-1">
                    <TrendingDown className="w-4 h-4 text-red-400 mr-1" />
                    <span className="text-red-400 font-semibold">NO</span>
                  </div>
                  <div className="text-2xl font-bold text-red-400">
                    {getNoOdds(market)}%
                  </div>
                  <div className="text-xs text-gray-400">
                    {market.noTokenPool} HBAR
                  </div>
                </div>
              </div>

              {/* Pool Info */}
              <div className="flex items-center justify-between text-sm text-gray-400">
                <div className="flex items-center">
                  <Users className="w-4 h-4 mr-1" />
                  Total Pool
                </div>
                <span className="font-semibold">{market.collateralPool} HBAR</span>
              </div>

              {/* Action Button */}
              {market.status === 'Active' && (
                <Button 
                  onClick={() => setSelectedMarket(market)}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  Place Bet
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Betting Modal */}
      {selectedMarket && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="bg-zinc-800 border-zinc-700 w-full max-w-md">
            <CardHeader>
              <CardTitle className="text-white">Place Your Bet</CardTitle>
              <CardDescription className="text-gray-400">
                {selectedMarket.question}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Bet Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant={betType === 'yes' ? 'default' : 'outline'}
                    onClick={() => setBetType('yes')}
                    className={betType === 'yes' ? 'bg-green-600 hover:bg-green-700' : 'border-zinc-600 text-gray-300 hover:bg-zinc-700'}
                  >
                    <TrendingUp className="w-4 h-4 mr-2" />
                    YES ({getYesOdds(selectedMarket)}%)
                  </Button>
                  <Button
                    variant={betType === 'no' ? 'default' : 'outline'}
                    onClick={() => setBetType('no')}
                    className={betType === 'no' ? 'bg-red-600 hover:bg-red-700' : 'border-zinc-600 text-gray-300 hover:bg-zinc-700'}
                  >
                    <TrendingDown className="w-4 h-4 mr-2" />
                    NO ({getNoOdds(selectedMarket)}%)
                  </Button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Amount (HBAR)
                </label>
                <Input
                  type="number"
                  value={betAmount}
                  onChange={(e) => setBetAmount(e.target.value)}
                  placeholder="0.0"
                  className="bg-zinc-700 border-zinc-600 text-white"
                />
                {betAmount && hbarPrice > 0 && (
                  <div className="mt-1 text-xs text-gray-400">
                    ≈ ${convertHBARToUSD(parseFloat(betAmount) || 0).toFixed(2)} USD
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button 
                  onClick={() => handlePlaceBet(selectedMarket.id)}
                  disabled={transactionState.isLoading || !betAmount}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  {transactionState.isLoading && <LoaderCircle className="w-4 h-4 mr-2 animate-spin" />}
                  Place Bet
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => setSelectedMarket(null)}
                  className="border-zinc-600 text-gray-300 hover:bg-zinc-700"
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
