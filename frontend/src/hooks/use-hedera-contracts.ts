import { useState, useCallback } from 'react';
import { useDAppConnector } from '@/components/client-providers';
import { 
  getContractService, 
  MarketInfo, 
  CreateMarketParams, 
  PlaceBetParams, 
  AuditLogParams 
} from '@/lib/hedera-contract-service';
import { ethers } from 'ethers';

export interface TransactionState {
  isLoading: boolean;
  error: string | null;
  txHash: string | null;
}

export function useHederaContracts() {
  const { dAppConnector } = useDAppConnector();
  const [transactionState, setTransactionState] = useState<TransactionState>({
    isLoading: false,
    error: null,
    txHash: null
  });

  const resetTransactionState = useCallback(() => {
    setTransactionState({
      isLoading: false,
      error: null,
      txHash: null
    });
  }, []);

  const executeTransaction = useCallback(async <T>(
    transactionFn: () => Promise<T>
  ): Promise<T | null> => {
    if (!dAppConnector?.signers[0]) {
      setTransactionState({
        isLoading: false,
        error: 'Wallet not connected',
        txHash: null
      });
      return null;
    }

    setTransactionState({
      isLoading: true,
      error: null,
      txHash: null
    });

    try {
      const result = await transactionFn();
      
      setTransactionState({
        isLoading: false,
        error: null,
        txHash: 'txHash' in result ? result.txHash : null
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Transaction failed';
      setTransactionState({
        isLoading: false,
        error: errorMessage,
        txHash: null
      });
      return null;
    }
  }, [dAppConnector]);

  const createMarket = useCallback(async (params: CreateMarketParams) => {
    if (!dAppConnector?.signers[0]) {
      throw new Error('Wallet not connected');
    }

    const contractService = getContractService();
    
    return executeTransaction(() => 
      contractService.createMarket(params, dAppConnector.signers[0])
    );
  }, [dAppConnector, executeTransaction]);

  const getAllMarkets = useCallback(async (): Promise<string[]> => {
    const contractService = getContractService();
    return contractService.getAllMarkets();
  }, []);

  const getMarketInfo = useCallback(async (marketAddress: string): Promise<MarketInfo> => {
    const contractService = getContractService();
    return contractService.getMarketInfo(marketAddress);
  }, []);

  const placeBet = useCallback(async (params: PlaceBetParams) => {
    if (!dAppConnector?.signers[0]) {
      throw new Error('Wallet not connected');
    }

    const contractService = getContractService();

    return executeTransaction(() => 
      contractService.placeBet(params, dAppConnector.signers[0])
    );
  }, [dAppConnector, executeTransaction]);

  const getUserShares = useCallback(async (
    marketAddress: string,
    userAddress: string
  ) => {
    const contractService = getContractService();
    return contractService.getUserShares(marketAddress, userAddress);
  }, []);

  const reportOutcome = useCallback(async (
    marketAddress: string,
    outcome: number
  ) => {
    if (!dAppConnector?.signers[0]) {
      throw new Error('Wallet not connected');
    }

    const contractService = getContractService();

    return executeTransaction(() => 
      contractService.reportOutcome(marketAddress, outcome, dAppConnector.signers[0])
    );
  }, [dAppConnector, executeTransaction]);

  const claimWinnings = useCallback(async (marketAddress: string) => {
    if (!dAppConnector?.signers[0]) {
      throw new Error('Wallet not connected');
    }

    const contractService = getContractService();

    return executeTransaction(() => 
      contractService.claimWinnings(marketAddress, dAppConnector.signers[0])
    );
  }, [dAppConnector, executeTransaction]);

  const submitAuditLog = useCallback(async (
    auditTrailAddress: string,
    params: AuditLogParams
  ) => {
    if (!dAppConnector?.signers[0]) {
      throw new Error('Wallet not connected');
    }

    const contractService = getContractService();

    return executeTransaction(() => 
      contractService.submitAuditLog(auditTrailAddress, params, dAppConnector.signers[0])
    );
  }, [dAppConnector, executeTransaction]);

  const getTransactionStatus = useCallback(async (txHash: string) => {
    const contractService = getContractService();
    return contractService.getTransactionStatus(txHash);
  }, []);

  const estimateGas = useCallback(async (
    to: string,
    data: string,
    value?: string
  ) => {
    const contractService = getContractService();
    return contractService.estimateGas(to, data, value);
  }, []);

  const getGasPrice = useCallback(async () => {
    const contractService = getContractService();
    return contractService.getGasPrice();
  }, []);

  const hbarToTinybars = useCallback((hbar: number) => {
    return ethers.parseEther(hbar.toString()).toString();
  }, []);

  const tinybarsToHbar = useCallback((tinybars: string) => {
    return parseFloat(ethers.formatEther(tinybars));
  }, []);

  return {
    // Transaction state
    transactionState,
    resetTransactionState,
    
    // Contract methods
    createMarket,
    getAllMarkets,
    getMarketInfo,
    placeBet,
    getUserShares,
    reportOutcome,
    claimWinnings,
    submitAuditLog,
    
    // Utility methods
    getTransactionStatus,
    estimateGas,
    getGasPrice,
    
    // Helper functions
    hbarToTinybars,
    tinybarsToHbar,
  };
}

export interface MarketWithInfo {
  address: string;
  info: MarketInfo;
}

export function useMarkets() {
  const { getAllMarkets, getMarketInfo } = useHederaContracts();
  const [markets, setMarkets] = useState<MarketWithInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMarkets = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const marketAddresses = await getAllMarkets();
      const marketsWithInfo: MarketWithInfo[] = [];

      for (const address of marketAddresses) {
        try {
          const info = await getMarketInfo(address);
          marketsWithInfo.push({ address, info });
        } catch (err) {
          console.error(`Failed to load market info for ${address}:`, err);
        }
      }

      setMarkets(marketsWithInfo);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load markets');
    } finally {
      setIsLoading(false);
    }
  }, [getAllMarkets, getMarketInfo]);

  const refreshMarket = useCallback(async (marketAddress: string) => {
    try {
      const info = await getMarketInfo(marketAddress);
      setMarkets(prev => 
        prev.map(market => 
          market.address === marketAddress 
            ? { ...market, info }
            : market
        )
      );
    } catch (err) {
      console.error(`Failed to refresh market ${marketAddress}:`, err);
    }
  }, [getMarketInfo]);

  return {
    markets,
    isLoading,
    error,
    loadMarkets,
    refreshMarket
  };
}
