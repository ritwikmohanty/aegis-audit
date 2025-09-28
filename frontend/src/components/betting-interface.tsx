"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TrendingUp, TrendingDown, DollarSign, Percent, AlertCircle, CheckCircle, Wallet } from "lucide-react"
import { cn } from "@/lib/utils"

interface BettingInterfaceProps {
  marketId: string
  currentPrices: {
    yes: number
    no: number
  }
  totalLiquidity: number
  userBalance?: number
  userPosition?: {
    yesShares: number
    noShares: number
    totalStaked: number
  }
}

export function BettingInterface({ 
  marketId, 
  currentPrices, 
  totalLiquidity, 
  userBalance = 100,
  userPosition 
}: BettingInterfaceProps) {
  const [betType, setBetType] = useState<"yes" | "no">("yes")
  const [betAmount, setBetAmount] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [priceImpact, setPriceImpact] = useState(0)
  const [expectedShares, setExpectedShares] = useState(0)
  const [expectedPayout, setExpectedPayout] = useState(0)

  // Calculate price impact and expected shares when bet amount changes
  useEffect(() => {
    if (!betAmount || isNaN(Number(betAmount))) {
      setPriceImpact(0)
      setExpectedShares(0)
      setExpectedPayout(0)
      return
    }

    const amount = Number(betAmount)
    const currentPrice = betType === "yes" ? currentPrices.yes : currentPrices.no
    
    // Simple price impact calculation (would be more complex in real implementation)
    const impact = (amount / totalLiquidity) * 100
    setPriceImpact(impact)
    
    // Calculate expected shares (simplified)
    const shares = amount / currentPrice
    setExpectedShares(shares)
    
    // Calculate expected payout if this side wins (simplified)
    const payout = shares * 1 // Assuming $1 payout per share if correct
    setExpectedPayout(payout)
  }, [betAmount, betType, currentPrices, totalLiquidity])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!betAmount || isNaN(Number(betAmount)) || Number(betAmount) <= 0) return

    setIsSubmitting(true)
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Reset form
      setBetAmount("")
      alert(`Successfully placed ${betType.toUpperCase()} bet of $${betAmount}!`)
      
    } catch (error) {
      console.error("Bet submission failed:", error)
      alert("Failed to place bet. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
  }

  const formatPercentage = (value: number) => {
    return `${(value * 100).toFixed(1)}%`
  }

  const getPriceColor = (price: number) => {
    if (price >= 0.7) return "text-green-600"
    if (price >= 0.4) return "text-yellow-600"
    return "text-red-600"
  }

  return (
    <div className="space-y-6">
      {/* Current Market Prices */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Market Prices
          </CardTitle>
          <CardDescription>
            Current probability and pricing information
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
              <div className="text-sm font-medium text-green-700">YES (Vulnerable)</div>
              <div className={cn("text-2xl font-bold", getPriceColor(currentPrices.yes))}>
                {formatPercentage(currentPrices.yes)}
              </div>
              <div className="text-xs text-green-600 mt-1">
                {formatCurrency(currentPrices.yes)} per share
              </div>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
              <div className="text-sm font-medium text-red-700">NO (Secure)</div>
              <div className={cn("text-2xl font-bold", getPriceColor(currentPrices.no))}>
                {formatPercentage(currentPrices.no)}
              </div>
              <div className="text-xs text-red-600 mt-1">
                {formatCurrency(currentPrices.no)} per share
              </div>
            </div>
          </div>
          
          <div className="mt-4 p-3 bg-muted rounded-lg">
            <div className="flex justify-between text-sm">
              <span>Total Liquidity:</span>
              <span className="font-medium">{formatCurrency(totalLiquidity)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* User Position (if exists) */}
      {userPosition && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Your Current Position
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-sm text-muted-foreground">YES Shares</div>
                <div className="text-lg font-bold text-green-600">{userPosition.yesShares.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">NO Shares</div>
                <div className="text-lg font-bold text-red-600">{userPosition.noShares.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Total Staked</div>
                <div className="text-lg font-bold">{formatCurrency(userPosition.totalStaked)}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Betting Interface */}
      <Card>
        <CardHeader>
          <CardTitle>Place Your Bet</CardTitle>
          <CardDescription>
            Choose your position and bet amount
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Bet Type Selection */}
            <div className="space-y-3">
              <Label>Bet Position</Label>
              <Tabs value={betType} onValueChange={(value) => setBetType(value as "yes" | "no")}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="yes" className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    YES (Vulnerable)
                  </TabsTrigger>
                  <TabsTrigger value="no" className="flex items-center gap-2">
                    <TrendingDown className="h-4 w-4" />
                    NO (Secure)
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Bet Amount */}
            <div className="space-y-2">
              <Label htmlFor="bet-amount">Bet Amount (HBAR)</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="bet-amount"
                  type="number"
                  placeholder="0.00"
                  value={betAmount}
                  onChange={(e) => setBetAmount(e.target.value)}
                  className="pl-9"
                  min="0.01"
                  step="0.01"
                  max={userBalance}
                />
              </div>
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Available: {formatCurrency(userBalance)}</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setBetAmount((userBalance * 0.25).toFixed(2))}
                    className="text-primary hover:underline"
                  >
                    25%
                  </button>
                  <button
                    type="button"
                    onClick={() => setBetAmount((userBalance * 0.5).toFixed(2))}
                    className="text-primary hover:underline"
                  >
                    50%
                  </button>
                  <button
                    type="button"
                    onClick={() => setBetAmount((userBalance * 0.75).toFixed(2))}
                    className="text-primary hover:underline"
                  >
                    75%
                  </button>
                  <button
                    type="button"
                    onClick={() => setBetAmount(userBalance.toFixed(2))}
                    className="text-primary hover:underline"
                  >
                    Max
                  </button>
                </div>
              </div>
            </div>

            {/* Bet Summary */}
            {betAmount && !isNaN(Number(betAmount)) && Number(betAmount) > 0 && (
              <div className="space-y-3 p-4 bg-muted rounded-lg">
                <h4 className="font-medium">Bet Summary</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex justify-between">
                    <span>Expected Shares:</span>
                    <span className="font-medium">{expectedShares.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Max Payout:</span>
                    <span className="font-medium text-green-600">{formatCurrency(expectedPayout)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Price Impact:</span>
                    <span className={cn(
                      "font-medium",
                      priceImpact > 5 ? "text-red-600" : priceImpact > 2 ? "text-yellow-600" : "text-green-600"
                    )}>
                      {priceImpact.toFixed(2)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Potential ROI:</span>
                    <span className="font-medium">
                      {((expectedPayout - Number(betAmount)) / Number(betAmount) * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
                
                {priceImpact > 5 && (
                  <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 p-2 rounded">
                    <AlertCircle className="h-4 w-4" />
                    High price impact. Consider splitting into smaller orders.
                  </div>
                )}
              </div>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={
                !betAmount || 
                isNaN(Number(betAmount)) || 
                Number(betAmount) <= 0 || 
                Number(betAmount) > userBalance || 
                isSubmitting
              }
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Placing Bet...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Place {betType.toUpperCase()} Bet
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Risk Disclaimer */}
      <Card className="border-amber-200 bg-amber-50/50">
        <CardHeader>
          <CardTitle className="text-amber-800 flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Risk Disclaimer
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-amber-700 space-y-2">
          <p>• Prediction markets involve risk. Only bet what you can afford to lose.</p>
          <p>• Prices are determined by market forces and may be volatile.</p>
          <p>• Payouts depend on final market resolution and total liquidity.</p>
          <p>• Markets may be resolved based on external audit results.</p>
        </CardContent>
      </Card>
    </div>
  )
}
