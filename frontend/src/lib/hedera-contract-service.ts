import { ethers } from 'ethers';

// Contract ABIs (these would be generated from the deployed contracts)
const MARKET_FACTORY_ABI = [
  "function createMarket(string memory _question, uint256 _endTime, address _oracle, string memory _yesSymbol, string memory _noSymbol) external",
  "function getMarketCount() external view returns (uint256)",
  "function getMarketAddress(uint256 _marketId) external view returns (address)",
  "event MarketCreated(uint256 indexed marketId, address indexed marketAddress, string question, address oracle, address yesToken, address noToken)"
];

const MARKET_ABI = [
  "function buyTokens(bool _isYesToken, uint256 _amountToReceive) external payable",
  "function reportOutcome(uint _outcome) external",
  "function claimWinnings() external",
  "function marketInfo() external view returns (tuple(string question, uint256 endTime, address oracle, uint256 totalYesShares, uint256 totalNoShares, uint256 totalCollateral, address yesTokenAddress, address noTokenAddress, uint8 outcome, bool isResolved))",
  "function yesShares(address user) external view returns (uint256)",
  "function noShares(address user) external view returns (uint256)",
  "event TokensPurchased(address indexed user, bool indexed isYesToken, uint256 amount, uint256 cost)",
  "event MarketResolved(uint8 outcome)",
  "event WinningsClaimed(address indexed user, uint256 amount)"
];

const AUDIT_TRAIL_ABI = [
  "function submitAuditLog(bytes memory _message) external payable",
  "function topicId() external view returns (address)",
  "event LogSubmitted(address indexed topicId, uint64 indexed sequenceNumber, bytes message)"
];

export interface MarketInfo {
  question: string;
  endTime: number;
  oracle: string;
  totalYesShares: string;
  totalNoShares: string;
  totalCollateral: string;
  yesTokenAddress: string;
  noTokenAddress: string;
  outcome: number; // 0: PENDING, 1: YES, 2: NO, 3: INVALID
  isResolved: boolean;
}

export interface CreateMarketParams {
  question: string;
  endTime: number;
  oracle: string;
  yesSymbol: string;
  noSymbol: string;
}

export interface PlaceBetParams {
  marketAddress: string;
  isYesToken: boolean;
  amount: string; // in wei
}

export interface AuditLogParams {
  message: string;
  value?: string; // HBAR amount for transaction fee
}

export class HederaContractService {
  private provider: ethers.JsonRpcProvider;
  private marketFactory: ethers.Contract;
  private marketFactoryAddress: string;

  constructor(rpcUrl: string, marketFactoryAddress: string) {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.marketFactoryAddress = marketFactoryAddress;
    this.marketFactory = new ethers.Contract(
      marketFactoryAddress,
      MARKET_FACTORY_ABI,
      this.provider
    );
  }

  /**
   * Create a new prediction market
   */
  async createMarket(
    params: CreateMarketParams,
    signer: ethers.Signer
  ): Promise<{ txHash: string; marketAddress: string }> {
    const marketFactoryWithSigner = this.marketFactory.connect(signer);
    
    const tx = await marketFactoryWithSigner.createMarket(
      params.question,
      params.endTime,
      params.oracle,
      params.yesSymbol,
      params.noSymbol
    );

    const receipt = await tx.wait();
    
    // Extract market address from event
    const marketCreatedEvent = receipt.logs.find(
      log => log.topics[0] === ethers.id("MarketCreated(uint256,address,string,address,address,address)")
    );
    
    if (!marketCreatedEvent) {
      throw new Error("MarketCreated event not found");
    }

    const decoded = this.marketFactory.interface.parseLog(marketCreatedEvent);
    const marketAddress = decoded.args.marketAddress;

    return {
      txHash: receipt.hash,
      marketAddress
    };
  }

  /**
   * Get all markets created by the factory
   */
  async getAllMarkets(): Promise<string[]> {
    const marketCount = await this.marketFactory.getMarketCount();
    const markets: string[] = [];

    for (let i = 0; i < marketCount; i++) {
      const marketAddress = await this.marketFactory.getMarketAddress(i);
      markets.push(marketAddress);
    }

    return markets;
  }

  /**
   * Get market information
   */
  async getMarketInfo(marketAddress: string): Promise<MarketInfo> {
    const market = new ethers.Contract(marketAddress, MARKET_ABI, this.provider);
    const info = await market.marketInfo();
    
    return {
      question: info.question,
      endTime: Number(info.endTime),
      oracle: info.oracle,
      totalYesShares: info.totalYesShares.toString(),
      totalNoShares: info.totalNoShares.toString(),
      totalCollateral: info.totalCollateral.toString(),
      yesTokenAddress: info.yesTokenAddress,
      noTokenAddress: info.noTokenAddress,
      outcome: Number(info.outcome),
      isResolved: info.isResolved
    };
  }

  /**
   * Place a bet on a market
   */
  async placeBet(
    params: PlaceBetParams,
    signer: ethers.Signer
  ): Promise<{ txHash: string }> {
    const market = new ethers.Contract(params.marketAddress, MARKET_ABI, signer);
    
    const tx = await market.buyTokens(
      params.isYesToken,
      params.amount,
      { value: params.amount }
    );

    const receipt = await tx.wait();
    
    return {
      txHash: receipt.hash
    };
  }

  /**
   * Get user's shares in a market
   */
  async getUserShares(
    marketAddress: string,
    userAddress: string
  ): Promise<{ yesShares: string; noShares: string }> {
    const market = new ethers.Contract(marketAddress, MARKET_ABI, this.provider);
    
    const yesShares = await market.yesShares(userAddress);
    const noShares = await market.noShares(userAddress);
    
    return {
      yesShares: yesShares.toString(),
      noShares: noShares.toString()
    };
  }

  /**
   * Report market outcome (oracle only)
   */
  async reportOutcome(
    marketAddress: string,
    outcome: number, // 1: YES, 2: NO, 3: INVALID
    signer: ethers.Signer
  ): Promise<{ txHash: string }> {
    const market = new ethers.Contract(marketAddress, MARKET_ABI, signer);
    
    const tx = await market.reportOutcome(outcome);
    const receipt = await tx.wait();
    
    return {
      txHash: receipt.hash
    };
  }

  /**
   * Claim winnings from a resolved market
   */
  async claimWinnings(
    marketAddress: string,
    signer: ethers.Signer
  ): Promise<{ txHash: string; amount: string }> {
    const market = new ethers.Contract(marketAddress, MARKET_ABI, signer);
    
    // Get balance before claiming
    const balanceBefore = await signer.provider.getBalance(await signer.getAddress());
    
    const tx = await market.claimWinnings();
    const receipt = await tx.wait();
    
    // Get balance after claiming
    const balanceAfter = await signer.provider.getBalance(await signer.getAddress());
    const claimedAmount = balanceAfter - balanceBefore;
    
    return {
      txHash: receipt.hash,
      amount: claimedAmount.toString()
    };
  }

  /**
   * Submit audit log to HCS
   */
  async submitAuditLog(
    auditTrailAddress: string,
    params: AuditLogParams,
    signer: ethers.Signer
  ): Promise<{ txHash: string }> {
    const auditTrail = new ethers.Contract(auditTrailAddress, AUDIT_TRAIL_ABI, signer);
    
    const tx = await auditTrail.submitAuditLog(
      ethers.toUtf8Bytes(params.message),
      { value: params.value || ethers.parseEther("0.01") } // Default 0.01 HBAR fee
    );

    const receipt = await tx.wait();
    
    return {
      txHash: receipt.hash
    };
  }

  /**
   * Get transaction status
   */
  async getTransactionStatus(txHash: string): Promise<{
    status: 'pending' | 'success' | 'failed';
    blockNumber?: number;
    gasUsed?: string;
  }> {
    const tx = await this.provider.getTransaction(txHash);
    if (!tx) {
      throw new Error("Transaction not found");
    }

    const receipt = await this.provider.getTransactionReceipt(txHash);
    
    if (!receipt) {
      return { status: 'pending' };
    }

    return {
      status: receipt.status === 1 ? 'success' : 'failed',
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString()
    };
  }

  /**
   * Estimate gas for a transaction
   */
  async estimateGas(
    to: string,
    data: string,
    value?: string
  ): Promise<string> {
    const gasEstimate = await this.provider.estimateGas({
      to,
      data,
      value: value ? ethers.parseEther(value) : undefined
    });
    
    return gasEstimate.toString();
  }

  /**
   * Get current gas price
   */
  async getGasPrice(): Promise<string> {
    const feeData = await this.provider.getFeeData();
    return feeData.gasPrice?.toString() || "0";
  }

  /**
   * Convert HBAR to tinybars (wei)
   */
  static hbarToTinybars(hbar: number): string {
    return ethers.parseEther(hbar.toString()).toString();
  }

  /**
   * Convert tinybars (wei) to HBAR
   */
  static tinybarsToHbar(tinybars: string): number {
    return parseFloat(ethers.formatEther(tinybars));
  }
}

// Singleton instance
let contractService: HederaContractService | null = null;

export const getContractService = (): HederaContractService => {
  if (!contractService) {
    const rpcUrl = process.env.NEXT_PUBLIC_HEDERA_RPC_URL || 'https://testnet.hashio.io/api';
    const marketFactoryAddress = process.env.NEXT_PUBLIC_MARKET_FACTORY_ADDRESS || '';
    
    if (!marketFactoryAddress) {
      throw new Error('Market factory address not configured');
    }
    
    contractService = new HederaContractService(rpcUrl, marketFactoryAddress);
  }
  
  return contractService;
};
