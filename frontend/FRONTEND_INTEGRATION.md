# Frontend Integration Guide

This guide explains the frontend integration features implemented for the Aegis Audit dApp.

## Features Implemented

### ✅ Smart Contract Integration
- **Real Contract Interactions**: Direct integration with deployed Hedera smart contracts
- **Transaction Handling**: Complete transaction lifecycle management
- **Error Handling**: Comprehensive error states and user feedback
- **Gas Estimation**: Real-time gas estimation for transactions

### ✅ Pyth Network Price Feeds
- **Real-time HBAR/USD Price**: Live price data from Pyth Network
- **Price Conversion**: HBAR ↔ USD conversion utilities
- **Confidence Intervals**: Price confidence and accuracy indicators
- **Multiple Assets**: Support for BTC, ETH, SOL price feeds

### ✅ Wallet Integration
- **Hedera Wallet Connect**: Full wallet connection support
- **Transaction Signing**: Secure transaction signing and execution
- **Account Management**: User account state management
- **Balance Display**: Real-time account balance updates

### ✅ Real-time Data
- **Live Market Data**: Real-time market state updates
- **Price Updates**: Continuous price feed updates
- **Transaction Status**: Real-time transaction monitoring
- **Market Pools**: Live betting pool updates

## Architecture

### Core Services

#### 1. Hedera Contract Service (`/src/lib/hedera-contract-service.ts`)
```typescript
// Contract interaction service
const contractService = new HederaContractService(rpcUrl, marketFactoryAddress);

// Create a new market
await contractService.createMarket(params, signer);

// Place a bet
await contractService.placeBet(params, signer);

// Get market information
const marketInfo = await contractService.getMarketInfo(marketAddress);
```

#### 2. Pyth Price Feed Service (`/src/lib/pyth-price-feed.ts`)
```typescript
// Real-time price feeds
const pythService = new PythPriceFeedService();

// Start price feed service
await pythService.start();

// Get HBAR price
const hbarPrice = pythService.getHBARPrice();

// Subscribe to price updates
const unsubscribe = pythService.subscribe('HBAR_USD', (price) => {
  console.log('HBAR price updated:', price);
});
```

### React Hooks

#### 1. Contract Interactions (`/src/hooks/use-hedera-contracts.ts`)
```typescript
const {
  createMarket,
  placeBet,
  transactionState,
  hbarToTinybars,
  tinybarsToHbar
} = useHederaContracts();

// Create market with real transaction
const result = await createMarket({
  question: "Will HBAR reach $0.10?",
  endTime: Math.floor(Date.now() / 1000) + 86400,
  oracle: oracleAddress,
  yesSymbol: "YES_HBAR",
  noSymbol: "NO_HBAR"
});
```

#### 2. Price Feeds (`/src/hooks/use-pyth-price.ts`)
```typescript
const {
  price,
  formatPrice,
  convertHBARToUSD,
  convertUSDToHBAR
} = useHBARPrice();

// Get formatted price
const formattedPrice = formatPrice(4); // "$0.0523"

// Convert amounts
const usdAmount = convertHBARToUSD(100); // 100 HBAR to USD
```

#### 3. Market Data (`/src/hooks/use-hedera-contracts.ts`)
```typescript
const {
  markets,
  isLoading,
  loadMarkets,
  refreshMarket
} = useMarkets();

// Load all markets
await loadMarkets();

// Refresh specific market
await refreshMarket(marketAddress);
```

### Components

#### 1. Price Display (`/src/components/price-display.tsx`)
- Real-time HBAR/USD price display
- Price trend indicators
- Confidence intervals
- USD conversion utilities

#### 2. Prediction Market (`/src/components/prediction-market.tsx`)
- Live market data display
- Real transaction handling
- Betting interface with USD equivalents
- Transaction status feedback

#### 3. Enhanced Header (`/src/components/header.tsx`)
- Integrated price display
- Wallet connection status
- Real-time price updates

## Configuration

### Environment Variables
```env
# Hedera Network Configuration
NEXT_PUBLIC_HEDERA_RPC_URL=https://testnet.hashio.io/api
NEXT_PUBLIC_MARKET_FACTORY_ADDRESS=0x...

# Pyth Network Configuration (optional)
NEXT_PUBLIC_PYTH_ENDPOINT=https://hermes.pyth.network/v2/updates
```

### Contract Addresses
Update the contract addresses in your environment variables:
```env
NEXT_PUBLIC_MARKET_FACTORY_ADDRESS=0x... # From deployment
NEXT_PUBLIC_AUDIT_TRAIL_ADDRESS=0x... # From deployment
```

## Usage Examples

### Creating a Market
```typescript
const { createMarket, transactionState } = useHederaContracts();

const handleCreateMarket = async () => {
  const result = await createMarket({
    question: "Will HBAR reach $0.10 by end of 2024?",
    endTime: Math.floor(Date.now() / 1000) + 86400, // 24 hours
    oracle: oracleAddress,
    yesSymbol: "YES_HBAR_2024",
    noSymbol: "NO_HBAR_2024"
  });

  if (result) {
    console.log('Market created:', result.marketAddress);
    console.log('Transaction hash:', result.txHash);
  }
};
```

### Placing a Bet
```typescript
const { placeBet, hbarToTinybars } = useHederaContracts();

const handlePlaceBet = async () => {
  const result = await placeBet({
    marketAddress: marketAddress,
    isYesToken: true,
    amount: hbarToTinybars(10) // 10 HBAR
  });

  if (result) {
    console.log('Bet placed:', result.txHash);
  }
};
```

### Price Conversion
```typescript
const { convertHBARToUSD, convertUSDToHBAR } = useHBARPrice();

// Convert 100 HBAR to USD
const usdValue = convertHBARToUSD(100);

// Convert $50 to HBAR
const hbarAmount = convertUSDToHBAR(50);
```

## Real-time Features

### 1. Price Updates
- Automatic price feed updates every few seconds
- Real-time conversion calculations
- Price trend indicators

### 2. Market Updates
- Live market pool updates
- Real-time betting activity
- Transaction status monitoring

### 3. Wallet Integration
- Automatic balance updates
- Transaction confirmation notifications
- Error state management

## Error Handling

### Transaction Errors
```typescript
const { transactionState } = useHederaContracts();

if (transactionState.error) {
  // Display error message
  console.error('Transaction failed:', transactionState.error);
}

if (transactionState.txHash) {
  // Transaction successful
  console.log('Transaction hash:', transactionState.txHash);
}
```

### Price Feed Errors
```typescript
const { error } = useHBARPrice();

if (error) {
  // Handle price feed error
  console.error('Price feed error:', error);
}
```

## Performance Optimizations

### 1. Caching
- Price data caching to reduce API calls
- Market data caching with smart refresh
- Transaction state persistence

### 2. Real-time Updates
- Efficient subscription management
- Automatic cleanup of listeners
- Optimized re-rendering

### 3. Error Recovery
- Automatic retry mechanisms
- Graceful degradation
- User-friendly error messages

## Testing

### Mock Tests
```bash
# Run mock tests (recommended for development)
npm run test:mock
```

### Integration Tests
```bash
# Run full test suite
npm test
```

## Deployment

### 1. Environment Setup
```bash
# Copy environment template
cp .env.example .env

# Update with your values
NEXT_PUBLIC_HEDERA_RPC_URL=your_rpc_url
NEXT_PUBLIC_MARKET_FACTORY_ADDRESS=your_contract_address
```

### 2. Build and Deploy
```bash
# Build for production
npm run build

# Start production server
npm start
```

## Troubleshooting

### Common Issues

1. **Price Feed Not Loading**
   - Check Pyth Network connectivity
   - Verify network configuration
   - Check browser console for errors

2. **Transaction Failures**
   - Verify wallet connection
   - Check account balance
   - Ensure contract addresses are correct

3. **Market Data Not Loading**
   - Verify contract deployment
   - Check RPC endpoint
   - Ensure proper network configuration

### Debug Mode
Enable debug logging:
```typescript
// In your component
const { transactionState } = useHederaContracts();

useEffect(() => {
  console.log('Transaction state:', transactionState);
}, [transactionState]);
```

## Security Considerations

1. **Private Key Management**: Never expose private keys in frontend code
2. **Transaction Validation**: Always validate transaction parameters
3. **Error Handling**: Don't expose sensitive error information
4. **Network Security**: Use HTTPS endpoints only

## Next Steps

1. **Mainnet Deployment**: Update configuration for mainnet
2. **Advanced Features**: Implement market resolution, oracle integration
3. **Performance**: Add more caching and optimization
4. **Analytics**: Implement user analytics and market insights
