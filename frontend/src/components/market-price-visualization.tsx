"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from "recharts"
import { TrendingUp, TrendingDown, BarChart3, Activity, DollarSign } from "lucide-react"
import { cn } from "@/lib/utils"

interface PricePoint {
  timestamp: string
  yesPrice: number
  noPrice: number
  volume: number
  liquidity: number
}

interface MarketPriceVisualizationProps {
  marketId: string
  currentPrices: {
    yes: number
    no: number
  }
  totalLiquidity: number
  volume24h: number
  priceHistory?: PricePoint[]
}

// Mock price history data
const generateMockPriceHistory = (): PricePoint[] => {
  const now = new Date()
  const points: PricePoint[] = []
  
  for (let i = 23; i >= 0; i--) {
    const timestamp = new Date(now.getTime() - i * 60 * 60 * 1000)
    const baseYes = 0.65 + Math.sin(i / 4) * 0.1 + (Math.random() - 0.5) * 0.05
    const yesPrice = Math.max(0.1, Math.min(0.9, baseYes))
    const noPrice = 1 - yesPrice
    
    points.push({
      timestamp: timestamp.toISOString(),
      yesPrice,
      noPrice,
      volume: 50 + Math.random() * 200,
      liquidity: 2800 + Math.random() * 800
    })
  }
  
  return points
}

export function MarketPriceVisualization({ 
  marketId, 
  currentPrices, 
  totalLiquidity, 
  volume24h,
  priceHistory = generateMockPriceHistory()
}: MarketPriceVisualizationProps) {
  const [selectedTimeframe, setSelectedTimeframe] = useState("24h")
  const [chartType, setChartType] = useState<"price" | "volume">("price")

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const formatPercentage = (value: number) => {
    return `${(value * 100).toFixed(1)}%`
  }

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    })
  }

  const priceChange24h = useMemo(() => {
    if (priceHistory.length < 2) return { yes: 0, no: 0 }
    
    const oldest = priceHistory[0]
    const current = currentPrices
    
    return {
      yes: current.yes - oldest.yesPrice,
      no: current.no - oldest.noPrice
    }
  }, [priceHistory, currentPrices])

  const chartData = useMemo(() => {
    return priceHistory.map(point => ({
      time: formatTime(point.timestamp),
      timestamp: point.timestamp,
      YES: point.yesPrice * 100,
      NO: point.noPrice * 100,
      Volume: point.volume,
      Liquidity: point.liquidity
    }))
  }, [priceHistory])

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border rounded-lg p-3 shadow-lg">
          <p className="font-medium">{label}</p>
          {chartType === "price" ? (
            <div className="space-y-1 mt-2">
              <p className="text-green-600">
                YES: {payload[0]?.value?.toFixed(1)}%
              </p>
              <p className="text-red-600">
                NO: {payload[1]?.value?.toFixed(1)}%
              </p>
            </div>
          ) : (
            <div className="space-y-1 mt-2">
              <p className="text-blue-600">
                Volume: {formatCurrency(payload[0]?.value || 0)}
              </p>
            </div>
          )}
        </div>
      )
    }
    return null
  }

  return (
    <div className="space-y-6">
      {/* Current Prices Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Live Market Data
          </CardTitle>
          <CardDescription>
            Real-time pricing and market statistics
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* YES Price */}
            <div className="text-center p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="text-sm font-medium text-green-700">YES (Vulnerable)</div>
              <div className="text-2xl font-bold text-green-800 mt-1">
                {formatPercentage(currentPrices.yes)}
              </div>
              <div className="flex items-center justify-center gap-1 mt-2">
                {priceChange24h.yes >= 0 ? (
                  <TrendingUp className="h-3 w-3 text-green-600" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-red-600" />
                )}
                <span className={cn(
                  "text-xs font-medium",
                  priceChange24h.yes >= 0 ? "text-green-600" : "text-red-600"
                )}>
                  {priceChange24h.yes >= 0 ? "+" : ""}{formatPercentage(priceChange24h.yes)} (24h)
                </span>
              </div>
            </div>

            {/* NO Price */}
            <div className="text-center p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="text-sm font-medium text-red-700">NO (Secure)</div>
              <div className="text-2xl font-bold text-red-800 mt-1">
                {formatPercentage(currentPrices.no)}
              </div>
              <div className="flex items-center justify-center gap-1 mt-2">
                {priceChange24h.no >= 0 ? (
                  <TrendingUp className="h-3 w-3 text-green-600" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-red-600" />
                )}
                <span className={cn(
                  "text-xs font-medium",
                  priceChange24h.no >= 0 ? "text-green-600" : "text-red-600"
                )}>
                  {priceChange24h.no >= 0 ? "+" : ""}{formatPercentage(priceChange24h.no)} (24h)
                </span>
              </div>
            </div>

            {/* Total Liquidity */}
            <div className="text-center p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="text-sm font-medium text-blue-700">Total Liquidity</div>
              <div className="text-2xl font-bold text-blue-800 mt-1">
                {formatCurrency(totalLiquidity)}
              </div>
              <div className="text-xs text-blue-600 mt-2">
                Available for trading
              </div>
            </div>

            {/* 24h Volume */}
            <div className="text-center p-4 bg-purple-50 border border-purple-200 rounded-lg">
              <div className="text-sm font-medium text-purple-700">24h Volume</div>
              <div className="text-2xl font-bold text-purple-800 mt-1">
                {formatCurrency(volume24h)}
              </div>
              <div className="text-xs text-purple-600 mt-2">
                Trading activity
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Price Chart */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Market Chart
              </CardTitle>
              <CardDescription>
                Historical price movements and trading volume
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Tabs value={chartType} onValueChange={(value) => setChartType(value as "price" | "volume")}>
                <TabsList>
                  <TabsTrigger value="price">Price</TabsTrigger>
                  <TabsTrigger value="volume">Volume</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              {chartType === "price" ? (
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis 
                    dataKey="time" 
                    tick={{ fontSize: 12 }}
                    interval="preserveStartEnd"
                  />
                  <YAxis 
                    domain={[0, 100]}
                    tick={{ fontSize: 12 }}
                    label={{ value: 'Price (%)', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Line 
                    type="monotone" 
                    dataKey="YES" 
                    stroke="#16a34a" 
                    strokeWidth={2}
                    dot={false}
                    name="YES"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="NO" 
                    stroke="#dc2626" 
                    strokeWidth={2}
                    dot={false}
                    name="NO"
                  />
                </LineChart>
              ) : (
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis 
                    dataKey="time" 
                    tick={{ fontSize: 12 }}
                    interval="preserveStartEnd"
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    label={{ value: 'Volume ($)', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="Volume"
                    stroke="#3b82f6"
                    fill="#3b82f6"
                    fillOpacity={0.3}
                  />
                </AreaChart>
              )}
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Market Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Market Cap
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalLiquidity * 1.2)}</div>
            <p className="text-sm text-muted-foreground">Estimated market value</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Open Interest</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1,247</div>
            <p className="text-sm text-muted-foreground">Active positions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Market Status</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">
              Active Trading
            </Badge>
            <p className="text-sm text-muted-foreground mt-2">Market open for bets</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}