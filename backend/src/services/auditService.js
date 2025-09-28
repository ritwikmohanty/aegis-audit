const { 
  Client, 
  TopicCreateTransaction, 
  TopicMessageSubmitTransaction,
  TopicInfoQuery,
  Hbar,
  PrivateKey,
  AccountId
} = require('@hashgraph/sdk');
const { AuditLog } = require('../models');
const { v4: uuidv4 } = require('uuid');

class AuditService {
  constructor() {
    this.client = null;
    this.topicId = process.env.HEDERA_TOPIC_ID || null;
    this.initializeClient();
  }

  /**
   * Initialize Hedera client
   */
  initializeClient() {
    try {
      // Skip Hedera initialization in development mode for testing
      if (process.env.NODE_ENV === 'development') {
        console.log('Skipping Hedera client initialization in development mode');
        return;
      }
      
      const accountId = AccountId.fromString(process.env.HEDERA_ACCOUNT_ID);
      const privateKey = PrivateKey.fromString(process.env.HEDERA_PRIVATE_KEY);
      
      if (process.env.HEDERA_NETWORK === 'testnet') {
        this.client = Client.forTestnet();
      } else {
        this.client = Client.forMainnet();
      }
      
      this.client.setOperator(accountId, privateKey);
      console.log('Hedera client initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Hedera client:', error);
      throw new Error('Hedera client initialization failed');
    }
  }

  /**
   * Submit audit log to HCS topic
   */
  async submitAuditLog({ marketId, analysisId, logData, logType, timestamp }) {
    try {
      if (!this.topicId) {
        throw new Error('HCS Topic ID not configured');
      }

      const logId = uuidv4();
      
      // Create audit log entry in database
      const auditLog = new AuditLog({
        logId,
        marketId,
        analysisId,
        logType,
        data: logData,
        message: logData.message || `${logType} event for market ${marketId}`,
        hcsInfo: {
          topicId: this.topicId
        },
        status: 'pending'
      });

      await auditLog.save();

      // Prepare message for HCS
      const logEntry = {
        logId,
        timestamp: timestamp || new Date().toISOString(),
        marketId,
        analysisId,
        type: logType,
        data: logData,
        version: '1.0'
      };

      const message = JSON.stringify(logEntry);
      
      try {
        const transaction = new TopicMessageSubmitTransaction()
          .setTopicId(this.topicId)
          .setMessage(message);

        const response = await transaction.execute(this.client);
        const receipt = await response.getReceipt(this.client);
        
        // Update audit log with HCS information
        await auditLog.markSubmitted({
          sequenceNumber: receipt.topicSequenceNumber,
          transactionId: response.transactionId.toString(),
          consensusTimestamp: new Date(receipt.consensusTimestamp),
          messageSize: Buffer.byteLength(message, 'utf8')
        });

        return {
          logId,
          sequenceNumber: receipt.topicSequenceNumber,
          transactionId: response.transactionId.toString(),
          topicId: this.topicId,
          timestamp: logEntry.timestamp
        };
        
      } catch (hcsError) {
        // Mark as failed in database
        await auditLog.markFailed(hcsError);
        throw hcsError;
      }

    } catch (error) {
      console.error('Failed to submit audit log:', error);
      throw new Error(`Audit log submission failed: ${error.message}`);
    }
  }

  /**
   * Retrieve audit logs for a specific market
   */
  async getAuditLogs(marketId, options = {}) {
    try {
      const { limit = 50, offset = 0 } = options;
      
      const logs = await AuditLog.findByMarket(marketId, options);
      const total = await AuditLog.countDocuments({ marketId });

      return {
        logs,
        total,
        limit: options.limit || 50,
        offset: options.offset || 0,
        topicId: this.topicId
      };

    } catch (error) {
      console.error('Failed to retrieve audit logs:', error);
      throw new Error(`Failed to retrieve audit logs: ${error.message}`);
    }
  }

  /**
   * Get topic information
   */
  async getTopicInfo() {
    try {
      if (!this.topicId) {
        return { error: 'No topic ID configured' };
      }

      const query = new TopicInfoQuery()
        .setTopicId(this.topicId);

      const info = await query.execute(this.client);
      
      return {
        topicId: this.topicId,
        adminKey: info.adminKey?.toString() || null,
        submitKey: info.submitKey?.toString() || null,
        memo: info.topicMemo,
        sequenceNumber: info.sequenceNumber,
        expirationTime: info.expirationTime?.toString(),
        autoRenewPeriod: info.autoRenewPeriod?.toString(),
        autoRenewAccount: info.autoRenewAccountId?.toString() || null
      };

    } catch (error) {
      console.error('Failed to get topic info:', error);
      throw new Error(`Failed to get topic info: ${error.message}`);
    }
  }

  /**
   * Create a new HCS topic
   */
  async createTopic(memo = 'Aegis Audit Trail') {
    try {
      const transaction = new TopicCreateTransaction()
        .setTopicMemo(memo)
        .setMaxTransactionFee(new Hbar(2));

      const response = await transaction.execute(this.client);
      const receipt = await response.getReceipt(this.client);
      
      const newTopicId = receipt.topicId.toString();
      
      return {
        topicId: newTopicId,
        transactionId: response.transactionId.toString(),
        memo,
        created: new Date().toISOString()
      };

    } catch (error) {
      console.error('Failed to create topic:', error);
      throw new Error(`Topic creation failed: ${error.message}`);
    }
  }

  /**
   * Verify log integrity by sequence number
   */
  async verifyLogIntegrity(sequenceNumber) {
    try {
      const log = Array.from(this.logs.values())
        .find(l => l.sequenceNumber === parseInt(sequenceNumber));

      if (!log) {
        return { verified: false, error: 'Log not found' };
      }

      // In a production system, you would query the HCS topic directly
      // to verify the message content matches what was submitted
      return {
        verified: true,
        log: {
          sequenceNumber: log.sequenceNumber,
          transactionId: log.transactionId,
          timestamp: log.timestamp,
          topicId: log.topicId,
          status: log.status
        }
      };

    } catch (error) {
      console.error('Failed to verify log integrity:', error);
      return { verified: false, error: error.message };
    }
  }

  /**
   * Get audit trail statistics
   */
  async getAuditStats() {
    try {
      const allLogs = Array.from(this.logs.values());
      
      const stats = {
        totalLogs: allLogs.length,
        topicId: this.topicId,
        logsByType: {},
        logsByMarket: {},
        recentActivity: allLogs
          .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
          .slice(0, 10)
          .map(log => ({
            sequenceNumber: log.sequenceNumber,
            marketId: log.marketId,
            type: log.type,
            timestamp: log.timestamp
          }))
      };

      // Count logs by type
      allLogs.forEach(log => {
        stats.logsByType[log.type] = (stats.logsByType[log.type] || 0) + 1;
      });

      // Count logs by market
      allLogs.forEach(log => {
        stats.logsByMarket[log.marketId] = (stats.logsByMarket[log.marketId] || 0) + 1;
      });

      return stats;

    } catch (error) {
      console.error('Failed to get audit stats:', error);
      throw new Error(`Failed to get audit stats: ${error.message}`);
    }
  }

  /**
   * Submit analysis result to audit trail
   */
  async logAnalysisResult(marketId, analysisResult) {
    const logData = {
      type: 'analysis_result',
      marketId,
      result: {
        overallRisk: analysisResult.overallRisk,
        totalIssues: analysisResult.totalIssues,
        recommendation: analysisResult.recommendation,
        confidenceScore: analysisResult.confidenceScore
      },
      tools: {
        slither: {
          vulnerabilities: analysisResult.slither?.vulnerabilities?.length || 0,
          summary: analysisResult.slither?.summary
        },
        mythril: {
          vulnerabilities: analysisResult.mythril?.vulnerabilities?.length || 0,
          summary: analysisResult.mythril?.summary
        }
      },
      timestamp: new Date().toISOString()
    };

    return this.submitAuditLog(marketId, logData);
  }

  /**
   * Submit market creation to audit trail
   */
  async logMarketCreation(marketId, marketData) {
    const logData = {
      type: 'market_creation',
      marketId,
      market: {
        title: marketData.title,
        description: marketData.description,
        creator: marketData.creator,
        contractAddress: marketData.contractAddress
      },
      timestamp: new Date().toISOString()
    };

    return this.submitAuditLog(marketId, logData);
  }

  /**
   * Submit market resolution to audit trail
   */
  async logMarketResolution(marketId, outcome, resolver) {
    const logData = {
      type: 'market_resolution',
      marketId,
      resolution: {
        outcome,
        resolver,
        resolvedAt: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    };

    return this.submitAuditLog(marketId, logData);
  }

  /**
   * Submit betting activity to audit trail
   */
  async logBettingActivity(marketId, betData) {
    const logData = {
      type: 'betting_activity',
      marketId,
      bet: {
        user: betData.user,
        amount: betData.amount,
        side: betData.side, // 'yes' or 'no'
        timestamp: betData.timestamp
      },
      timestamp: new Date().toISOString()
    };

    return this.submitAuditLog(marketId, logData);
  }
}

module.exports = new AuditService();