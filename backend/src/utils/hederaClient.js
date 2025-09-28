const { 
  Client, 
  PrivateKey, 
  AccountId,
  ContractId,
  ContractCallQuery,
  ContractExecuteTransaction,
  ContractFunctionParameters,
  Hbar
} = require('@hashgraph/sdk');

class HederaClient {
  constructor() {
    this.client = null;
    this.operatorAccountId = null;
    this.operatorPrivateKey = null;
    this.isInitialized = false;
  }

  /**
   * Initialize the Hedera client
   */
  async initialize() {
    if (this.isInitialized) {
      return this.client;
    }

    try {
      // Validate environment variables
      const accountId = process.env.HEDERA_ACCOUNT_ID;
      const privateKey = process.env.HEDERA_PRIVATE_KEY;
      const network = process.env.HEDERA_NETWORK || 'testnet';

      if (!accountId || !privateKey) {
        throw new Error('HEDERA_ACCOUNT_ID and HEDERA_PRIVATE_KEY environment variables are required');
      }

      // Parse account ID and private key
      this.operatorAccountId = AccountId.fromString(accountId);
      this.operatorPrivateKey = PrivateKey.fromString(privateKey);

      // Initialize client based on network
      if (network.toLowerCase() === 'mainnet') {
        this.client = Client.forMainnet();
      } else {
        this.client = Client.forTestnet();
      }

      // Set operator
      this.client.setOperator(this.operatorAccountId, this.operatorPrivateKey);

      // Set default transaction fees and timeouts
      this.client.setDefaultMaxTransactionFee(new Hbar(2));
      this.client.setDefaultMaxQueryPayment(new Hbar(1));

      this.isInitialized = true;
      console.log(`✅ Hedera client initialized for ${network} with account: ${accountId}`);

      return this.client;
    } catch (error) {
      console.error('Failed to initialize Hedera client:', error);
      throw error;
    }
  }

  /**
   * Get the initialized client
   */
  async getClient() {
    if (!this.isInitialized) {
      await this.initialize();
    }
    return this.client;
  }

  /**
   * Query a smart contract function
   */
  async queryContract(contractId, functionName, parameters = null, gas = 100000) {
    const client = await this.getClient();
    
    try {
      const query = new ContractCallQuery()
        .setContractId(contractId)
        .setGas(gas)
        .setFunction(functionName, parameters);

      const result = await query.execute(client);
      return result;
    } catch (error) {
      console.error(`Contract query failed for ${contractId}.${functionName}:`, error);
      throw error;
    }
  }

  /**
   * Execute a smart contract function
   */
  async executeContract(contractId, functionName, parameters = null, gasLimit = 300000, payableAmount = null) {
    const client = await this.getClient();
    
    try {
      const transaction = new ContractExecuteTransaction()
        .setContractId(contractId)
        .setGas(gasLimit)
        .setFunction(functionName, parameters);

      if (payableAmount) {
        transaction.setPayableAmount(payableAmount);
      }

      const response = await transaction.execute(client);
      const receipt = await response.getReceipt(client);

      return {
        transactionId: response.transactionId.toString(),
        status: receipt.status.toString(),
        contractFunctionResult: receipt.contractFunctionResult
      };
    } catch (error) {
      console.error(`Contract execution failed for ${contractId}.${functionName}:`, error);
      throw error;
    }
  }

  /**
   * Create parameters for contract calls
   */
  createContractParameters() {
    return new ContractFunctionParameters();
  }

  /**
   * Get account balance
   */
  async getAccountBalance(accountId = null) {
    const client = await this.getClient();
    const account = accountId ? AccountId.fromString(accountId) : this.operatorAccountId;
    
    try {
      const balance = await new AccountBalanceQuery()
        .setAccountId(account)
        .execute(client);
      
      return balance.hbars.toTinybars().toString();
    } catch (error) {
      console.error(`Failed to get balance for account ${account}:`, error);
      throw error;
    }
  }

  /**
   * Convert Hbar to tinybars
   */
  hbarToTinybars(hbarAmount) {
    return Hbar.fromTinybars(hbarAmount * 100000000); // 1 HBAR = 100M tinybars
  }

  /**
   * Convert tinybars to Hbar
   */
  tinybarsToHbar(tinybars) {
    return tinybars / 100000000;
  }

  /**
   * Get network information
   */
  getNetworkInfo() {
    return {
      network: process.env.HEDERA_NETWORK || 'testnet',
      operatorAccount: this.operatorAccountId?.toString(),
      isInitialized: this.isInitialized
    };
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      if (!this.isInitialized) {
        return { status: 'not_initialized' };
      }

      // Try to query account balance as a health check
      const balance = await this.getAccountBalance();
      
      return {
        status: 'healthy',
        network: this.getNetworkInfo(),
        balance: this.tinybarsToHbar(balance),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Close the client connection
   */
  async close() {
    if (this.client) {
      this.client.close();
      this.isInitialized = false;
      console.log('Hedera client connection closed');
    }
  }
}

// Export singleton instance
const hederaClient = new HederaClient();

module.exports = hederaClient;