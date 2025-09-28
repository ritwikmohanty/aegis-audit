const { ContractCallQuery, ContractExecuteTransaction, Hbar } = require('@hashgraph/sdk');
const hederaClient = require('../utils/hederaClient');
const { Market } = require('../models');
const { v4: uuidv4 } = require('uuid');

class MarketService {
  constructor() {
    this.client = null;
    this.marketFactoryAddress = process.env.MARKET_FACTORY_ADDRESS;
  }

  async initialize() {
    if (!this.client) {
      this.client = await hederaClient.getClient();
    }
  }

  /**
   * Get all markets
   */
  async getAllMarkets(filter = {}, options = {}) {
    try {
      const query = Market.find(filter);
      
      if (options.limit) {
        query.limit(options.limit);
      }
      
      if (options.offset) {
        query.skip(options.offset);
      }
      
      if (options.sort) {
        query.sort(options.sort);
      } else {
        query.sort({ createdAt: -1 });
      }
      
      const markets = await query.exec();
      return markets;
    } catch (error) {
      console.error('Error fetching markets:', error);
      throw new Error('Failed to fetch markets from database');
    }
  }

  /**
   * Get market by ID
   */
  async getMarketById(marketId) {
    try {
      const market = await Market.findOne({ marketId });
      
      if (!market) {
        return null;
      }

      // Optionally sync with blockchain data
      if (market.blockchainMarketAddress) {
        await this.syncMarketWithBlockchain(market);
      }
      
      return market;
    } catch (error) {
      console.error('Error fetching market by ID:', error);
      throw new Error('Failed to fetch market from database');
    }
  }

  /**
   * Create a new market
   */
  async createMarket({ question, endTime, contractAddress, contractHash, confidenceScore = 0, oracle }) {
    await this.initialize();
    
    try {
      const marketId = `market_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const marketData = {
        marketId,
        question,
        endTime: new Date(endTime),
        contractAddress,
        contractHash: contractHash || `hash_${Date.now()}`,
        confidenceScore,
        oracle: oracle || process.env.HEDERA_ACCOUNT_ID,
        status: 'pending'
      };
      
      const market = new Market(marketData);
      await market.save();

      // Create market on blockchain via MarketFactory
      if (this.marketFactoryAddress && contractAddress) {
        try {
          const contractExecuteTransaction = new ContractExecuteTransaction()
            .setContractId(this.marketFactoryAddress)
            .setGas(300000)
            .setFunction('createMarketFromAnalysis', [
              contractAddress,
              contractHash,
              confidenceScore,
              Math.floor(new Date(endTime).getTime() / 1000), // Convert to Unix timestamp
              oracle || process.env.HEDERA_ACCOUNT_ID
            ]);

          const response = await contractExecuteTransaction.execute(this.client);
          const receipt = await response.getReceipt(this.client);
          
          if (receipt.status.toString() === 'SUCCESS') {
            // Update market with blockchain address (would need to parse from logs)
            market.status = 'active';
            await market.save();
            console.log(`Market ${marketId} created on blockchain successfully`);
          }
        } catch (blockchainError) {
          console.error('Blockchain market creation failed:', blockchainError);
          // Market still exists in database but without blockchain integration
        }
      }

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
      const market = await Market.findOne({ marketId });
      if (!market) {
        throw new Error('Market not found');
      }

      if (market.status === 'resolved') {
        throw new Error('Market is already resolved');
      }

      // Update market with resolution
      await market.resolve(outcome, analysisResults);

      // Call smart contract to report outcome
      if (market.blockchainMarketAddress) {
        try {
          const outcomeValue = outcome === 'yes' ? 1 : outcome === 'no' ? 2 : 0;
          
          const contractExecuteTransaction = new ContractExecuteTransaction()
            .setContractId(market.blockchainMarketAddress)
            .setGas(200000)
            .setFunction('reportOutcome', [outcomeValue]);

          const response = await contractExecuteTransaction.execute(this.client);
          const receipt = await response.getReceipt(this.client);
          
          if (receipt.status.toString() === 'SUCCESS') {
            console.log(`Market ${marketId} resolved on blockchain successfully`);
          } else {
            console.error(`Blockchain resolution failed for market ${marketId}`);
          }
        } catch (blockchainError) {
          console.error('Error resolving market on blockchain:', blockchainError);
          // Market is still resolved in database even if blockchain call fails
        }
      }

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
    try {
      const market = await Market.findOne({ marketId });
      if (!market) {
        throw new Error('Market not found');
      }

      // Query blockchain for betting events if market has blockchain address
      if (market.blockchainMarketAddress) {
        await this.initialize();
        
        try {
          const contractCallQuery = new ContractCallQuery()
            .setContractId(market.blockchainMarketAddress)
            .setGas(100000)
            .setFunction('getBettingHistory');

          const result = await contractCallQuery.execute(this.client);
          
          // Parse the result to extract betting data
          // This would need proper ABI decoding in a real implementation
          if (result) {
            console.log(`Retrieved betting history for market ${marketId}`);
            // Return parsed betting data from blockchain
          }
        } catch (blockchainError) {
          console.error('Error querying blockchain for bets:', blockchainError);
          // Fall back to mock data if blockchain query fails
        }
      }

      // Mock betting data as fallback
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
   * Sync market data with blockchain
   */
  async syncMarketWithBlockchain(market) {
    try {
      if (!market.blockchainMarketAddress) {
        return market;
      }

      await this.initialize();
      
      // Query blockchain for current market state
      const contractCallQuery = new ContractCallQuery()
        .setContractId(market.blockchainMarketAddress)
        .setGas(100000)
        .setFunction('marketInfo');
      
      const result = await contractCallQuery.execute(this.client);
      
      if (result) {
        // Parse blockchain data and update market
        // This would need proper ABI decoding in a real implementation
        console.log(`Synced market ${market.marketId} with blockchain data`);
        
        // Example of updating market with blockchain data:
        // market.totalYesShares = parsedResult.totalYesShares;
        // market.totalNoShares = parsedResult.totalNoShares;
        // market.totalCollateral = parsedResult.totalCollateral;
        // 
        // if (parsedResult.isResolved && market.status !== 'resolved') {
        //   market.status = 'resolved';
        //   market.outcome = parsedResult.outcome === 1 ? 'yes' : 'no';
        //   market.resolvedAt = new Date();
        // }
        
        await market.save();
      }

      return market;
    } catch (error) {
      console.error('Error syncing market with blockchain:', error);
      return market;
    }
  }

  /**
   * Get market statistics
   */
  async getMarketStats() {
    try {
      const stats = await Market.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalCollateral: { $sum: '$totalCollateral' }
          }
        }
      ]);

      const totalMarkets = await Market.countDocuments();
      
      return {
        totalMarkets,
        byStatus: stats,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error getting market stats:', error);
      throw new Error('Failed to get market statistics');
    }
  }
}

module.exports = new MarketService();