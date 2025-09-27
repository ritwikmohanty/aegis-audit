const { Client, ContractCallQuery, ContractExecuteTransaction, Hbar } = require('@hashgraph/sdk');
const hederaClient = require('../utils/hederaClient');

class MarketService {
  constructor() {
    this.client = null;
    this.marketFactoryAddress = process.env.MARKET_FACTORY_ADDRESS;
    this.markets = new Map(); // In-memory storage for demo - use database in production
  }

  async initialize() {
    if (!this.client) {
      this.client = await hederaClient.getClient();
    }
  }

  /**
   * Get all markets
   */
  async getAllMarkets() {
    await this.initialize();
    
    try {
      // In a real implementation, this would query the blockchain or database
      // For now, return the in-memory markets
      return Array.from(this.markets.values());
    } catch (error) {
      console.error('Error fetching markets:', error);
      throw new Error('Failed to fetch markets from blockchain');
    }
  }

  /**
   * Get market by ID
   */
  async getMarketById(marketId) {
    await this.initialize();
    
    try {
      // Check in-memory storage first
      if (this.markets.has(marketId)) {
        return this.markets.get(marketId);
      }

      // Query blockchain for market details
      const contractCallQuery = new ContractCallQuery()
        .setContractId(marketId)
        .setGas(100000)
        .setFunction('getMarketInfo');

      const result = await contractCallQuery.execute(this.client);
      
      // Parse the result and create market object
      const marketInfo = this.parseMarketInfo(result);
      
      // Cache the result
      this.markets.set(marketId, marketInfo);
      
      return marketInfo;
    } catch (error) {
      console.error('Error fetching market by ID:', error);
      return null;
    }
  }

  /**
   * Create a new market
   */
  async createMarket({ question, endTime, contractAddress }) {
    await this.initialize();
    
    try {
      const marketId = `market_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const market = {
        id: marketId,
        question,
        endTime: new Date(endTime),
        contractAddress,
        createdAt: new Date(),
        status: 'active',
        totalYesShares: 0,
        totalNoShares: 0,
        totalCollateral: 0,
        outcome: null,
        isResolved: false,
        analysisResults: null
      };

      // Store in memory (use database in production)
      this.markets.set(marketId, market);

      return market;
    } catch (error) {
      console.error('Error creating market:', error);
      throw new Error('Failed to create market');
    }
  }

  /**
   * Resolve a market with outcome
   */
  async resolveMarket(marketId, outcome, analysisResults) {
    await this.initialize();
    
    try {
      const market = this.markets.get(marketId);
      if (!market) {
        throw new Error('Market not found');
      }

      if (market.isResolved) {
        throw new Error('Market is already resolved');
      }

      // Update market with resolution
      market.outcome = outcome;
      market.isResolved = true;
      market.analysisResults = analysisResults;
      market.resolvedAt = new Date();

      // In a real implementation, this would call the smart contract
      // const contractExecuteTransaction = new ContractExecuteTransaction()
      //   .setContractId(market.contractAddress)
      //   .setGas(200000)
      //   .setFunction('reportOutcome', new ContractFunctionParameters().addUint256(outcome));

      this.markets.set(marketId, market);

      return market;
    } catch (error) {
      console.error('Error resolving market:', error);
      throw new Error('Failed to resolve market');
    }
  }

  /**
   * Get betting history for a market
   */
  async getMarketBets(marketId) {
    await this.initialize();
    
    try {
      // In a real implementation, this would query blockchain events
      // For now, return mock data
      return [
        {
          id: 'bet_1',
          marketId,
          user: '0x1234...5678',
          isYesToken: true,
          amount: '1000000000000000000', // 1 HBAR in tinybars
          timestamp: new Date(Date.now() - 3600000), // 1 hour ago
          transactionId: '0.0.123456@1234567890.123456789'
        },
        {
          id: 'bet_2',
          marketId,
          user: '0x8765...4321',
          isYesToken: false,
          amount: '2000000000000000000', // 2 HBAR in tinybars
          timestamp: new Date(Date.now() - 1800000), // 30 minutes ago
          transactionId: '0.0.123456@1234567890.987654321'
        }
      ];
    } catch (error) {
      console.error('Error fetching market bets:', error);
      throw new Error('Failed to fetch market bets');
    }
  }

  /**
   * Parse market info from blockchain query result
   */
  parseMarketInfo(result) {
    // This would parse the actual blockchain response
    // Implementation depends on the contract's return format
    return {
      question: 'Sample Market Question',
      endTime: new Date(Date.now() + 86400000), // 24 hours from now
      oracle: '0x1234567890123456789012345678901234567890',
      totalYesShares: 0,
      totalNoShares: 0,
      totalCollateral: 0,
      outcome: null,
      isResolved: false
    };
  }

  /**
   * Get market statistics
   */
  async getMarketStats() {
    const markets = Array.from(this.markets.values());
    
    return {
      totalMarkets: markets.length,
      activeMarkets: markets.filter(m => !m.isResolved).length,
      resolvedMarkets: markets.filter(m => m.isResolved).length,
      totalVolume: markets.reduce((sum, m) => sum + (m.totalCollateral || 0), 0)
    };
  }
}

module.exports = new MarketService();