import { useState, useEffect, useCallback } from 'react';
import { pythPriceFeedService, PriceData } from '@/lib/pyth-price-feed';

/**
 * Hook to get real-time price data from Pyth Network
 */
export function usePythPrice(symbol: string) {
  const [priceData, setPriceData] = useState<PriceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Get initial price
    const initialPrice = pythPriceFeedService.getPrice(symbol);
    setPriceData(initialPrice);
    setIsLoading(false);

    // Subscribe to updates
    const unsubscribe = pythPriceFeedService.subscribe(symbol, (newPrice) => {
      setPriceData(newPrice);
      setError(null);
    });

    return unsubscribe;
  }, [symbol]);

  const formatPrice = useCallback((decimals: number = 4) => {
    return pythPriceFeedService.formatPrice(priceData, decimals);
  }, [priceData]);

  const getConfidenceInterval = useCallback(() => {
    return pythPriceFeedService.getConfidenceInterval(priceData);
  }, [priceData]);

  return {
    priceData,
    isLoading,
    error,
    formatPrice,
    getConfidenceInterval,
    price: priceData ? priceData.price * Math.pow(10, priceData.exponent) : 0,
    confidence: priceData ? priceData.confidence * Math.pow(10, priceData.exponent) : 0,
    publishTime: priceData?.publishTime || 0,
  };
}

/**
 * Hook specifically for HBAR/USD price
 */
export function useHBARPrice() {
  const {
    priceData,
    isLoading,
    error,
    formatPrice,
    getConfidenceInterval,
    price,
    confidence,
    publishTime,
  } = usePythPrice('HBAR_USD');

  const convertHBARToUSD = useCallback((hbarAmount: number) => {
    return hbarAmount * price;
  }, [price]);

  const convertUSDToHBAR = useCallback((usdAmount: number) => {
    if (price === 0) return 0;
    return usdAmount / price;
  }, [price]);

  return {
    priceData,
    isLoading,
    error,
    formatPrice,
    getConfidenceInterval,
    price,
    confidence,
    publishTime,
    convertHBARToUSD,
    convertUSDToHBAR,
  };
}

/**
 * Hook to get multiple price feeds at once
 */
export function useMultiplePrices(symbols: string[]) {
  const [prices, setPrices] = useState<Map<string, PriceData>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribers: (() => void)[] = [];

    // Get initial prices
    const initialPrices = new Map<string, PriceData>();
    symbols.forEach(symbol => {
      const price = pythPriceFeedService.getPrice(symbol);
      if (price) {
        initialPrices.set(symbol, price);
      }
    });
    setPrices(initialPrices);
    setIsLoading(false);

    // Subscribe to updates for each symbol
    symbols.forEach(symbol => {
      const unsubscribe = pythPriceFeedService.subscribe(symbol, (newPrice) => {
        setPrices(prev => {
          const updated = new Map(prev);
          updated.set(symbol, newPrice);
          return updated;
        });
        setError(null);
      });
      unsubscribers.push(unsubscribe);
    });

    return () => {
      unsubscribers.forEach(unsubscribe => unsubscribe());
    };
  }, [symbols]);

  const getPrice = useCallback((symbol: string) => {
    return prices.get(symbol) || null;
  }, [prices]);

  const formatPrice = useCallback((symbol: string, decimals: number = 4) => {
    const priceData = prices.get(symbol);
    return pythPriceFeedService.formatPrice(priceData || null, decimals);
  }, [prices]);

  return {
    prices,
    isLoading,
    error,
    getPrice,
    formatPrice,
  };
}

/**
 * Hook to initialize the Pyth price feed service
 */
export function usePythPriceService() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initializeService = async () => {
      try {
        await pythPriceFeedService.start();
        setIsInitialized(true);
        setError(null);
      } catch (err) {
        console.error('Failed to initialize Pyth price service:', err);
        setError(err instanceof Error ? err.message : 'Failed to initialize price service');
      }
    };

    initializeService();

    return () => {
      pythPriceFeedService.stop();
    };
  }, []);

  return {
    isInitialized,
    error,
  };
}
