'use client';

import { useHBARPrice } from '@/hooks/use-pyth-price';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Activity, DollarSign, Clock } from 'lucide-react';
import { useEffect, useState } from 'react';

interface PriceDisplayProps {
  className?: string;
  showConfidence?: boolean;
  showLastUpdate?: boolean;
}

export function PriceDisplay({ 
  className = '', 
  showConfidence = true, 
  showLastUpdate = true 
}: PriceDisplayProps) {
  const { 
    price, 
    confidence, 
    formatPrice, 
    getConfidenceInterval, 
    isLoading, 
    error, 
    publishTime,
    convertHBARToUSD,
    convertUSDToHBAR 
  } = useHBARPrice();

  const [previousPrice, setPreviousPrice] = useState<number>(0);
  const [trend, setTrend] = useState<'up' | 'down' | 'neutral'>('neutral');

  useEffect(() => {
    if (price > 0 && previousPrice > 0) {
      if (price > previousPrice) {
        setTrend('up');
      } else if (price < previousPrice) {
        setTrend('down');
      } else {
        setTrend('neutral');
      }
    }
    setPreviousPrice(price);
  }, [price, previousPrice]);

  const confidenceInterval = getConfidenceInterval();
  const lastUpdate = publishTime ? new Date(publishTime * 1000) : null;

  if (error) {
    return (
      <Card className={`bg-red-900/20 border-red-700 ${className}`}>
        <CardContent className="p-4">
          <div className="flex items-center space-x-2">
            <Activity className="w-4 h-4 text-red-400" />
            <span className="text-red-400 text-sm">Price feed error: {error}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className={`bg-zinc-800 border-zinc-700 ${className}`}>
        <CardContent className="p-4">
          <div className="flex items-center space-x-2">
            <Activity className="w-4 h-4 text-gray-400 animate-pulse" />
            <span className="text-gray-400 text-sm">Loading HBAR price...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`bg-zinc-800 border-zinc-700 ${className}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <DollarSign className="w-5 h-5 text-blue-400" />
              <span className="text-white font-semibold">HBAR</span>
            </div>
            
            <div className="flex items-center space-x-2">
              {trend === 'up' && <TrendingUp className="w-4 h-4 text-green-400" />}
              {trend === 'down' && <TrendingDown className="w-4 h-4 text-red-400" />}
              {trend === 'neutral' && <Activity className="w-4 h-4 text-gray-400" />}
              
              <span className="text-white text-lg font-bold">
                ${formatPrice(4)}
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {showConfidence && confidenceInterval && (
              <Badge variant="outline" className="border-blue-600 text-blue-400">
                ±${confidenceInterval.upper.toFixed(4)}
              </Badge>
            )}
            
            {showLastUpdate && lastUpdate && (
              <div className="flex items-center space-x-1 text-gray-400 text-xs">
                <Clock className="w-3 h-3" />
                <span>{lastUpdate.toLocaleTimeString()}</span>
              </div>
            )}
          </div>
        </div>

        {showConfidence && confidenceInterval && (
          <div className="mt-2 text-xs text-gray-400">
            Confidence: ${confidenceInterval.lower.toFixed(4)} - ${confidenceInterval.upper.toFixed(4)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface PriceConverterProps {
  className?: string;
}

export function PriceConverter({ className = '' }: PriceConverterProps) {
  const { convertHBARToUSD, convertUSDToHBAR, formatPrice, price } = useHBARPrice();
  const [hbarAmount, setHbarAmount] = useState<string>('1');
  const [usdAmount, setUsdAmount] = useState<string>('');

  useEffect(() => {
    if (hbarAmount && price > 0) {
      const hbar = parseFloat(hbarAmount);
      if (!isNaN(hbar)) {
        const usd = convertHBARToUSD(hbar);
        setUsdAmount(usd.toFixed(4));
      }
    }
  }, [hbarAmount, convertHBARToUSD, price]);

  const handleHbarChange = (value: string) => {
    setHbarAmount(value);
    if (value && price > 0) {
      const hbar = parseFloat(value);
      if (!isNaN(hbar)) {
        const usd = convertHBARToUSD(hbar);
        setUsdAmount(usd.toFixed(4));
      }
    }
  };

  const handleUsdChange = (value: string) => {
    setUsdAmount(value);
    if (value && price > 0) {
      const usd = parseFloat(value);
      if (!isNaN(usd)) {
        const hbar = convertUSDToHBAR(usd);
        setHbarAmount(hbar.toFixed(4));
      }
    }
  };

  return (
    <Card className={`bg-zinc-800 border-zinc-700 ${className}`}>
      <CardContent className="p-4">
        <h3 className="text-white font-semibold mb-3">HBAR ↔ USD Converter</h3>
        
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-gray-300 mb-1">HBAR Amount</label>
            <input
              type="number"
              value={hbarAmount}
              onChange={(e) => handleHbarChange(e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm text-gray-300 mb-1">USD Amount</label>
            <input
              type="number"
              value={usdAmount}
              onChange={(e) => handleUsdChange(e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div className="text-xs text-gray-400">
            Current rate: 1 HBAR = ${formatPrice(4)} USD
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface MarketPriceDisplayProps {
  className?: string;
}

export function MarketPriceDisplay({ className = '' }: MarketPriceDisplayProps) {
  const { price, formatPrice, isLoading, error } = useHBARPrice();

  if (error) {
    return (
      <div className={`text-red-400 text-sm ${className}`}>
        Price feed unavailable
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={`text-gray-400 text-sm ${className}`}>
        Loading price...
      </div>
    );
  }

  return (
    <div className={`text-white ${className}`}>
      <span className="text-lg font-bold">${formatPrice(4)}</span>
      <span className="text-sm text-gray-400 ml-1">HBAR</span>
    </div>
  );
}
