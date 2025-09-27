import { HermesClient } from '@pythnetwork/hermes-client';

// Pyth Network configuration
const PYTH_HERMES_ENDPOINT = 'https://hermes.pyth.network';

// Price feed IDs for different assets
const PRICE_FEED_IDS = {
  HBAR_USD: '3728e591097635310e6341af53db8b7ee42da9b3a8d918f9463ce9cca886dfbd', // HBAR/USD price feed ID from Pyth Network
  BTC_USD: '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
  ETH_USD: '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
  SOL_USD: '0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d',
} as const;

export interface PriceData {
  price: number;
  confidence: number;
  exponent: number;
  publishTime: number;
  symbol: string;
}

export class PythPriceFeedService {
  private connection: HermesClient;
  private prices: Map<string, PriceData> = new Map();
  private listeners: Map<string, Set<(price: PriceData) => void>> = new Map();
  private eventSource: EventSource | null = null;

  constructor() {
    this.connection = new HermesClient(PYTH_HERMES_ENDPOINT, {});
  }

  /**
   * Start the price feed service
   */
  async start(): Promise<void> {
    try {
      console.log('Starting Pyth price feed service...');
      
      // Get initial prices for all feeds with retry logic
      const priceIds = Object.values(PRICE_FEED_IDS);
      console.log('Fetching initial prices for feed IDs:', priceIds);
      
      let initialPricesLoaded = false;
      let retryCount = 0;
      const maxRetries = 3;
      
      while (!initialPricesLoaded && retryCount < maxRetries) {
        try {
          console.log(`Attempting to fetch initial prices (attempt ${retryCount + 1}/${maxRetries})...`);
          const priceUpdates = await this.connection.getLatestPriceUpdates(priceIds);
          console.log('Received initial price updates:', priceUpdates);

          if (priceUpdates && priceUpdates.parsed) {
            for (const update of priceUpdates.parsed) {
              const symbol = this.getSymbolFromPriceId(update.id);
              const priceData: PriceData = {
                price: Number(update.price.price),
                confidence: Number(update.price.conf),
                exponent: update.price.expo,
                publishTime: update.price.publish_time,
                symbol,
              };
              
              console.log(`Setting initial price for ${symbol}:`, priceData);
              this.prices.set(symbol, priceData);
              this.notifyListeners(symbol, priceData);
            }
            initialPricesLoaded = true;
            console.log('Initial prices loaded successfully');
          } else {
            throw new Error('No parsed price data received');
          }
        } catch (error) {
          retryCount++;
          console.error(`Error fetching initial prices (attempt ${retryCount}/${maxRetries}):`, error);
          
          if (retryCount < maxRetries) {
            // Wait before retrying (exponential backoff)
            const waitTime = Math.pow(2, retryCount) * 1000; // 2s, 4s, 8s
            console.log(`Waiting ${waitTime}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
          }
        }
      }
      
      if (!initialPricesLoaded) {
        console.warn('Failed to load initial prices after all retries. Service will continue with periodic refresh.');
      }

      // Set up periodic price refresh with proper error handling
      console.log('Setting up periodic price refresh...');
      
      // Refresh prices every 30 seconds with retry logic
      const refreshPrices = async () => {
        let retryCount = 0;
        const maxRetries = 3;
        
        while (retryCount < maxRetries) {
          try {
            console.log(`Attempting to refresh prices (attempt ${retryCount + 1}/${maxRetries})...`);
            const refreshedPrices = await this.connection.getLatestPriceUpdates(priceIds);
            
            if (refreshedPrices && refreshedPrices.parsed) {
              for (const update of refreshedPrices.parsed) {
                const symbol = this.getSymbolFromPriceId(update.id);
                const priceData: PriceData = {
                  price: Number(update.price.price),
                  confidence: Number(update.price.conf),
                  exponent: update.price.expo,
                  publishTime: update.price.publish_time,
                  symbol,
                };
                
                console.log(`Refreshing price for ${symbol}:`, priceData);
                this.prices.set(symbol, priceData);
                this.notifyListeners(symbol, priceData);
              }
              console.log('Price refresh successful');
              return; // Success, exit retry loop
            } else {
              console.warn('No parsed price data received');
            }
          } catch (error) {
            retryCount++;
            console.error(`Error refreshing prices (attempt ${retryCount}/${maxRetries}):`, error);
            
            if (retryCount < maxRetries) {
              // Wait before retrying (exponential backoff)
              const waitTime = Math.pow(2, retryCount) * 1000; // 2s, 4s, 8s
              console.log(`Waiting ${waitTime}ms before retry...`);
              await new Promise(resolve => setTimeout(resolve, waitTime));
            } else {
              console.error('All retry attempts failed. Will try again in next interval.');
            }
          }
        }
      };
      
      // Initial refresh
      await refreshPrices();
      
      // Set up interval for periodic refresh
      setInterval(refreshPrices, 30000);

      console.log('Pyth price feed service started successfully (using periodic refresh)');
    } catch (error) {
      console.error('Failed to start Pyth price feed service:', error);
      throw error;
    }
  }

  /**
   * Stop the price feed service
   */
  stop(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    console.log('Pyth price feed service stopped');
  }

  /**
   * Get the current price for a symbol
   */
  getPrice(symbol: string): PriceData | null {
    return this.prices.get(symbol) || null;
  }

  /**
   * Get HBAR price specifically
   */
  getHBARPrice(): PriceData | null {
    return this.getPrice('HBAR/USD');
  }

  /**
   * Subscribe to price updates for a specific symbol
   */
  subscribe(symbol: string, callback: (price: PriceData) => void): () => void {
    if (!this.listeners.has(symbol)) {
      this.listeners.set(symbol, new Set());
    }
    
    const symbolListeners = this.listeners.get(symbol)!;
    symbolListeners.add(callback);
    
    // Return unsubscribe function
    return () => {
      symbolListeners.delete(callback);
      if (symbolListeners.size === 0) {
        this.listeners.delete(symbol);
      }
    };
  }

  /**
   * Get all current prices
   */
  getAllPrices(): Map<string, PriceData> {
    return new Map(this.prices);
  }

  /**
   * Format price for display
   */
  formatPrice(priceData: PriceData | null, decimals: number = 4): string {
    if (!priceData) {
      console.log('formatPrice: No price data available');
      return 'N/A';
    }
    console.log('formatPrice: Price data available:', priceData);
    const actualPrice = priceData.price * Math.pow(10, priceData.exponent);
    return actualPrice.toFixed(decimals);
  }

  /**
   * Get confidence interval for a price
   */
  getConfidenceInterval(priceData: PriceData | null): { lower: number; upper: number } | null {
    if (!priceData) return null;
    
    return {
      lower: priceData.price - priceData.confidence,
      upper: priceData.price + priceData.confidence,
    };
  }

  /**
   * Convert price feed ID to symbol
   */
  private getSymbolFromPriceId(priceId: string): string {
    const entries = Object.entries(PRICE_FEED_IDS);
    for (const [key, id] of entries) {
      if (id === priceId) {
        return key.replace('_', '/');
      }
    }
    return 'UNKNOWN';
  }

  /**
   * Notify all listeners for a symbol
   */
  private notifyListeners(symbol: string, priceData: PriceData): void {
    const symbolListeners = this.listeners.get(symbol);
    if (symbolListeners) {
      symbolListeners.forEach(callback => {
        try {
          callback(priceData);
        } catch (error) {
          console.error(`Error in price listener for ${symbol}:`, error);
        }
      });
    }
  }
}

// Export singleton instance
export const pythPriceFeedService = new PythPriceFeedService();

// Utility functions
export const getHBARPriceInUSD = (): number => {
  const hbarPrice = pythPriceFeedService.getHBARPrice();
  return hbarPrice ? hbarPrice.price : 0;
};

export const convertHBARToUSD = (hbarAmount: number): number => {
  const hbarPrice = getHBARPriceInUSD();
  return hbarAmount * hbarPrice;
};

export const convertUSDToHBAR = (usdAmount: number): number => {
  const hbarPrice = getHBARPriceInUSD();
  return hbarPrice > 0 ? usdAmount / hbarPrice : 0;
};
