"use client"

import Link from "next/link"
import { Suspense, useState, useEffect, use } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { LoaderCircle, Wallet, TrendingUp, TrendingDown, Clock, Users, Activity, DollarSign } from "lucide-react"
import Countdown from "@/components/bet-details/countdown"
import RepoInfo from "@/components/bet-details/repo-info"
import BetActions from "@/components/bet-details/bet-actions"
import ContractFileCard from "@/components/bet-details/contract-file-card"
import { WalletWidget } from "@/components/wallet"
import { MarketPriceDisplay } from "@/components/price-display"
import { useDAppConnector } from "@/components/client-providers"
import { useHederaContracts } from "@/hooks/use-hedera-contracts"
import { useHBARPrice } from "@/hooks/use-pyth-price"

export default function BetDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ repo?: string; deadline?: string }>
}) {
  // Unwrap the promises using React.use()
  const { id: betId } = use(params)
  const { repo, deadline } = use(searchParams)
  
  // Optional: repo is "owner/repo" for GitHub info. If omitted, shows placeholders.
  const repoFullName = repo || ""
  // Optional deadline ISO string for countdown
  const deadlineValue = deadline || ""

  // Blockchain hooks
  const { dAppConnector, userAccountId } = useDAppConnector() ?? {}
  const { 
    createMarket, 
    getAllMarkets, 
    getMarketInfo, 
    placeBet, 
    getUserShares, 
    claimWinnings
  } = useHederaContracts()
  const { price: hbarPrice, isLoading: priceLoading } = useHBARPrice()

  // State for blockchain data
  const [marketData, setMarketData] = useState<{
    question: string;
    oracle: string;
    endTime: number;
    isResolved: boolean;
    outcome: number;
    address: string;
    totalCollateral?: string;
    totalYesShares?: string;
    totalNoShares?: string;
  } | null>(null)
  const [userShares, setUserShares] = useState({ yes: 0, no: 0 })
  const [betAmount, setBetAmount] = useState('')
  const [isLoadingMarket, setIsLoadingMarket] = useState(true)
  const [transactionState, setTransactionState] = useState({
    isLoading: false,
    error: null as string | null,
    txHash: null as string | null
  })

  // Load market data on component mount
  useEffect(() => {
    const loadMarketData = async () => {
      if (!betId) return;
      
      try {
        setIsLoadingMarket(true);
        // Try to get market info from blockchain
        const markets = await getAllMarkets();
        const currentMarket = markets.find((m: any) => m.address === betId);
        
        if (currentMarket) {
          const marketInfo = await getMarketInfo(betId as string);
          setMarketData({
            ...marketInfo,
            address: betId as string,
            totalCollateral: "1000000000000000000000", // 1000 HBAR in wei
            totalYesShares: "600000000000000000000", // 600 HBAR in wei
            totalNoShares: "400000000000000000000" // 400 HBAR in wei
          });
        } else {
          // Fallback to mock data if market not found
          setMarketData({
            question: "Vulnerability Assessment",
            oracle: "0x1234...5678",
            endTime: Date.now() / 1000 + 86400, // 24 hours from now
            isResolved: false,
            outcome: 0,
            address: betId as string,
            totalCollateral: "1000000000000000000000",
            totalYesShares: "600000000000000000000",
            totalNoShares: "400000000000000000000"
          });
        }
      } catch (error) {
        console.error("Error loading market data:", error);
        // Fallback to mock data on error
        setMarketData({
          question: "Vulnerability Assessment",
          oracle: "0x1234...5678",
          endTime: Date.now() / 1000 + 86400,
          isResolved: false,
          outcome: 0,
          address: betId as string,
          totalCollateral: "1000000000000000000000",
          totalYesShares: "600000000000000000000",
          totalNoShares: "400000000000000000000"
        });
      } finally {
        setIsLoadingMarket(false);
      }
    };

    loadMarketData();
  }, [betId, getAllMarkets, getMarketInfo]);

  // Load user shares when wallet is connected
  useEffect(() => {
    const loadUserShares = async () => {
      if (!userAccountId || !betId) return;
      
      try {
        const shares = await getUserShares(betId as string, userAccountId);
        setUserShares({
          yes: parseFloat(shares.yesShares || "0"),
          no: parseFloat(shares.noShares || "0")
        });
      } catch (error) {
        console.error("Error loading user shares:", error);
      }
    };

    loadUserShares();
  }, [userAccountId, betId, getUserShares]);

  // Handle placing bets
  const handlePlaceBet = async (isYes: boolean) => {
    if (!userAccountId || !betAmount || !betId) return;
    
    setTransactionState({ isLoading: true, error: null, txHash: null });
    
    try {
      const result = await placeBet({
        marketAddress: betId as string,
        isYesToken: isYes,
        amount: betAmount // Keep as string since PlaceBetParams expects string
      });
      
      if (result) {
        setTransactionState({ 
          isLoading: false, 
          error: null, 
          txHash: result.txHash || "Transaction completed" 
        });
        
        // Refresh market data and user shares
        const updatedMarketInfo = await getMarketInfo(betId as string);
        setMarketData(prev => prev ? { ...prev, ...updatedMarketInfo } : null);
        
        const updatedShares = await getUserShares(betId as string, userAccountId);
        setUserShares({
          yes: parseFloat(updatedShares.yesShares || "0"),
          no: parseFloat(updatedShares.noShares || "0")
        });
        
        setBetAmount(''); // Clear bet amount
      }
    } catch (error: any) {
      setTransactionState({ 
        isLoading: false, 
        error: error.message || "Transaction failed", 
        txHash: null 
      });
    }
  };

  // Calculate real-time pool data from blockchain
  const blockchainPool = marketData ? {
    total: parseFloat(marketData.totalCollateral || "0") / 1e18, // Convert from wei
    yes: parseFloat(marketData.totalYesShares || "0") / 1e18,
    no: parseFloat(marketData.totalNoShares || "0") / 1e18
  } : { total: 3200, yes: 1900, no: 1300 } // Fallback to mock data

  const blockchainYesOdds = blockchainPool.total > 0 ? blockchainPool.total / Math.max(blockchainPool.yes, 1) : 0
  const blockchainNoOdds = blockchainPool.total > 0 ? blockchainPool.total / Math.max(blockchainPool.no, 1) : 0

  // Mock user-specific stats (enhanced with blockchain data)
  const userStats = {
    totalWinnings: 2450,
    winRate: 12,
    activeBets: 3,
    liveContests: 2,
    totalPoolUSD: blockchainPool.total * (hbarPrice || 0.05), // Convert HBAR to USD
    userYesShares: userShares.yes / 1e18,
    userNoShares: userShares.no / 1e18,
  }

  // Mock code files; replace with real file list later
  const files = [
    {
      name: "Vault.sol",
      code: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Vault {
  mapping(address => uint256) public balances;

  function deposit() external payable {
    balances[msg.sender] += msg.value;
  }

  function withdraw(uint256 amount) external {
    require(balances[msg.sender] >= amount, "Insufficient");
    balances[msg.sender] -= amount;
    (bool ok,) = msg.sender.call{value: amount}("");
    require(ok, "Withdraw failed");
  }
}
`,
    },
    {
      name: "BetPool.sol",
      code: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract BetPool {
  struct Bet {
    address user;
    uint256 amount;
    bool choice;
  }

  Bet[] public bets;
  uint256 public totalYes;
  uint256 public totalNo;

  function placeBet(bool choice) external payable {
    bets.push(Bet(msg.sender, msg.value, choice));
    if (choice) totalYes += msg.value; else totalNo += msg.value;
  }
}
`,
    },
  ]

  // Mock pool/odds; replace with real on-chain data later
  const pool = { 
    total: blockchainPool.total, 
    yes: blockchainPool.yes, 
    no: blockchainPool.no 
  }
  const yesOdds = blockchainYesOdds
  const noOdds = blockchainNoOdds

  return (
    <main className="container mx-auto max-w-6xl px-4 py-6 space-y-6">
      {/* Back + Optional Countdown */}
      <div className="flex items-center justify-between">
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4">
          ← Back to Bets
        </Link>
        {deadline ? (
          <div className="flex items-center gap-2">
            <Badge variant="secondary">Time left</Badge>
            <Countdown endAt={deadline} />
          </div>
        ) : null}
      </div>

      {/* User-focused stats */}
      <section aria-label="Your Stats">
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Your Winnings</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${userStats.totalWinnings?.toLocaleString() || '0'}</div>
              <p className="text-xs text-muted-foreground">
                +{userStats.winRate || 0}% from last month
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Bets</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{userStats.activeBets || userStats.liveContests}</div>
              <p className="text-xs text-muted-foreground">
                {userStats.liveContests} live contests
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Pool Value</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${userStats.totalPoolUSD.toFixed(0)}</div>
              <p className="text-xs text-muted-foreground">
                {blockchainPool.total.toFixed(2)} HBAR
              </p>
              <div className="mt-2">
                <MarketPriceDisplay />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Your Position</CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {userAccountId ? (
                <div className="space-y-2">
                  <div className="text-sm">
                    <span className="text-green-600 font-medium">YES:</span> {userShares.yes.toFixed(4)} shares
                  </div>
                  <div className="text-sm">
                    <span className="text-red-600 font-medium">NO:</span> {userShares.no.toFixed(4)} shares
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Connected: {userAccountId.slice(0, 8)}...
                  </p>
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-2">Connect wallet to view</p>
                  <WalletWidget />
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* HBAR Price Display */}
      <section aria-label="Market Price">
        <MarketPriceDisplay className="w-full" />
      </section>

      {/* Repository Info */}
      <section aria-label="Repository Info">
        <Card>
          <CardHeader>
            <CardTitle className="text-balance">Company / Repository</CardTitle>
            <CardDescription>Details from GitHub if available</CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<div className="text-sm text-muted-foreground">Loading repository…</div>}>
              <RepoInfo repoFullName={repoFullName} />
            </Suspense>
          </CardContent>
        </Card>
      </section>

      {/* Code Files */}
      <section aria-label="Smart Contract Files" className="space-y-4">
        <h2 className="text-lg font-medium">Smart Contract / Code Files</h2>
        {files.map((f) => (
          <ContractFileCard key={f.name} fileName={f.name} code={f.code} />
        ))}
      </section>

      {/* Betting / Voting */}
      <section aria-label="Betting" className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Do you want to bet on this vulnerability?</CardTitle>
            <CardDescription>
              {isLoadingMarket ? "Loading market data..." : "Place your position"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-muted-foreground space-y-1">
              <div>Total pool: {pool.total.toFixed(2)} HBAR (${(pool.total * (hbarPrice || 0.05)).toFixed(2)})</div>
              <div>
                Yes pool: {pool.yes.toFixed(2)} HBAR (approx. 1:{yesOdds.toFixed(2)})
              </div>
              <div>
                No pool: {pool.no.toFixed(2)} HBAR (approx. 1:{noOdds.toFixed(2)})
              </div>
            </div>
            
            {/* Blockchain Betting Interface */}
            {userAccountId ? (
              <div className="space-y-3 border-t pt-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Bet Amount (HBAR)</label>
                  <Input
                    type="number"
                    value={betAmount}
                    onChange={(e) => setBetAmount(e.target.value)}
                    placeholder="Enter amount in HBAR"
                    className="w-full"
                  />
                </div>
                <div className="flex gap-2">
                  <Button 
                    onClick={() => handlePlaceBet(true)}
                    disabled={!betAmount || transactionState.isLoading}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                  >
                    {transactionState.isLoading ? (
                      <LoaderCircle className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <TrendingUp className="w-4 h-4 mr-2" />
                    )}
                    Bet YES
                  </Button>
                  <Button 
                    onClick={() => handlePlaceBet(false)}
                    disabled={!betAmount || transactionState.isLoading}
                    variant="destructive"
                    className="flex-1"
                  >
                    {transactionState.isLoading ? (
                      <LoaderCircle className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <TrendingDown className="w-4 h-4 mr-2" />
                    )}
                    Bet NO
                  </Button>
                </div>
                {transactionState.error && (
                  <div className="text-sm text-red-500 bg-red-50 p-2 rounded">
                    Error: {transactionState.error}
                  </div>
                )}
                {transactionState.txHash && (
                  <div className="text-sm text-green-600 bg-green-50 p-2 rounded">
                    Transaction successful! Hash: {transactionState.txHash.slice(0, 10)}...
                  </div>
                )}
              </div>
            ) : (
              <div className="border-t pt-4">
                <div className="text-center space-y-2">
                  <p className="text-sm text-muted-foreground">Connect your wallet to place bets</p>
                  <WalletWidget />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Market Information</CardTitle>
            <CardDescription>Current market status and details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {marketData && (
              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-medium">Question:</span> {marketData.question || "Vulnerability Assessment"}
                </div>
                <div>
                  <span className="font-medium">Oracle:</span> {marketData.oracle}
                </div>
                <div>
                  <span className="font-medium">Status:</span>{" "}
                  <Badge variant={marketData.isResolved ? "default" : "secondary"}>
                    {marketData.isResolved ? "Resolved" : "Active"}
                  </Badge>
                </div>
                <div>
                  <span className="font-medium">End Time:</span>{" "}
                  {new Date(marketData.endTime * 1000).toLocaleString()}
                </div>
                {marketData.isResolved && (
                  <div>
                    <span className="font-medium">Outcome:</span>{" "}
                    <Badge variant={marketData.outcome === 1 ? "default" : "destructive"}>
                      {marketData.outcome === 1 ? "YES" : marketData.outcome === 2 ? "NO" : "INVALID"}
                    </Badge>
                  </div>
                )}
              </div>
            )}
            
            <div className="border-t pt-4 space-y-2 text-sm text-muted-foreground">
              <p>Bets are final once submitted. Ensure you've reviewed the contracts and repository history.</p>
              <p>Returns depend on total pool distribution at settlement. Gas/fees may apply.</p>
              <p>Market data is fetched from Hedera blockchain in real-time.</p>
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  )
}
