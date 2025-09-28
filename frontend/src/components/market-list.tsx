"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Search, Filter, TrendingUp, Calendar, DollarSign, ExternalLink, GitBranch, Clock } from "lucide-react"
import { BetCard } from "./bet-card"
import { cn } from "@/lib/utils"

type MarketStatus = "active" | "analyzing" | "resolved"
type SortOption = "liquidity" | "created" | "closing" | "volume"

interface Market {
  id: string
  title: string
  contractAddress: string
  network: string
  repository?: string
  status: MarketStatus
  totalLiquidity: number
  yesPrice: number
  noPrice: number
  volume24h: number
  createdAt: string
  closingAt: string
  description: string
  tags: string[]
}

// Mock data - replace with real data from your API
const mockMarkets: Market[] = [
  {
    id: "1",
    title: "Reentrancy Vulnerability in Payment Module",
    contractAddress: "0x1234...abcd",
    network: "Ethereum",
    repository: "org/payments-service",
    status: "active",
    totalLiquidity: 3400,
    yesPrice: 0.68,
    noPrice: 0.32,
    volume24h: 850,
    createdAt: "2025-09-26T10:00:00Z",
    closingAt: "2025-09-30T18:00:00Z",
    description: "Critical reentrancy vulnerability detected in payment processing module",
    tags: ["high-severity", "defi", "payment"]
  },
  {
    id: "2",
    title: "Improper Input Validation — Auth Bypass",
    contractAddress: "0x5678...efgh",
    network: "Hedera",
    repository: "acme/auth-gateway",
    status: "active",
    totalLiquidity: 1275,
    yesPrice: 0.45,
    noPrice: 0.55,
    volume24h: 320,
    createdAt: "2025-09-27T14:30:00Z",
    closingAt: "2025-09-29T12:00:00Z",
    description: "Authentication bypass through improper input validation",
    tags: ["medium-severity", "auth", "web3"]
  },
  {
    id: "3",
    title: "Race Condition in Staking Rewards",
    contractAddress: "0x9abc...ijkl",
    network: "Polygon",
    repository: "dao/staking-contracts",
    status: "analyzing",
    totalLiquidity: 910,
    yesPrice: 0.72,
    noPrice: 0.28,
    volume24h: 180,
    createdAt: "2025-09-28T08:15:00Z",
    closingAt: "2025-10-02T16:30:00Z",
    description: "Potential race condition in staking reward distribution mechanism",
    tags: ["high-severity", "staking", "dao"]
  },
  {
    id: "4",
    title: "Privilege Escalation via Role Misconfig",
    contractAddress: "0xdef0...mnop",
    network: "BSC",
    repository: "monorepo/iam-service",
    status: "resolved",
    totalLiquidity: 2100,
    yesPrice: 0.89,
    noPrice: 0.11,
    volume24h: 450,
    createdAt: "2025-09-25T16:45:00Z",
    closingAt: "2025-09-28T09:00:00Z",
    description: "Role misconfiguration leading to privilege escalation - CONFIRMED VULNERABLE",
    tags: ["critical", "access-control", "enterprise"]
  }
]

const sortOptions = [
  { value: "liquidity", label: "Total Liquidity", icon: DollarSign },
  { value: "created", label: "Recently Created", icon: Calendar },
  { value: "closing", label: "Closing Soon", icon: Clock },
  { value: "volume", label: "24h Volume", icon: TrendingUp },
]

export function MarketList() {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedStatus, setSelectedStatus] = useState<MarketStatus | "all">("all")
  const [sortBy, setSortBy] = useState<SortOption>("liquidity")
  const [viewMode, setViewMode] = useState<"grid" | "list">("list")

  const filteredAndSortedMarkets = useMemo(() => {
    let filtered = mockMarkets

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(market =>
        market.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        market.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        market.repository?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        market.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    }

    // Filter by status
    if (selectedStatus !== "all") {
      filtered = filtered.filter(market => market.status === selectedStatus)
    }

    // Sort markets
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "liquidity":
          return b.totalLiquidity - a.totalLiquidity
        case "created":
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        case "closing":
          return new Date(a.closingAt).getTime() - new Date(b.closingAt).getTime()
        case "volume":
          return b.volume24h - a.volume24h
        default:
          return 0
      }
    })

    return filtered
  }, [searchQuery, selectedStatus, sortBy])

  const getStatusBadge = (status: MarketStatus) => {
    const variants = {
      active: "bg-green-100 text-green-800 border-green-200",
      analyzing: "bg-yellow-100 text-yellow-800 border-yellow-200",
      resolved: "bg-gray-100 text-gray-800 border-gray-200"
    }
    
    return (
      <Badge variant="outline" className={cn("capitalize", variants[status])}>
        {status}
      </Badge>
    )
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const formatPercentage = (value: number) => {
    return `${(value * 100).toFixed(0)}%`
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl md:text-3xl font-semibold">Prediction Markets</h2>
          <p className="text-muted-foreground mt-1">
            {filteredAndSortedMarkets.length} markets • Total Liquidity: {formatCurrency(filteredAndSortedMarkets.reduce((sum, m) => sum + m.totalLiquidity, 0))}
          </p>
        </div>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filter & Sort Markets
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            {/* Search */}
            <div className="space-y-2">
              <Label htmlFor="search">Search Markets</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search by title, description..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Status Filter */}
            <div className="space-y-2">
              <Label>Status</Label>
              <Tabs value={selectedStatus} onValueChange={(value) => setSelectedStatus(value as MarketStatus | "all")}>
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
                  <TabsTrigger value="active" className="text-xs">Active</TabsTrigger>
                  <TabsTrigger value="analyzing" className="text-xs">Analyzing</TabsTrigger>
                  <TabsTrigger value="resolved" className="text-xs">Resolved</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Sort */}
            <div className="space-y-2">
              <Label>Sort By</Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    {sortOptions.find(opt => opt.value === sortBy)?.label}
                    <Filter className="h-4 w-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-full">
                  {sortOptions.map((option) => {
                    const Icon = option.icon
                    return (
                      <DropdownMenuItem
                        key={option.value}
                        onSelect={() => setSortBy(option.value as SortOption)}
                      >
                        <Icon className="mr-2 h-4 w-4" />
                        {option.label}
                      </DropdownMenuItem>
                    )
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* View Mode */}
            <div className="space-y-2">
              <Label>View</Label>
              <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as "grid" | "list")}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="list">List</TabsTrigger>
                  <TabsTrigger value="grid">Grid</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Markets Grid/List */}
      {filteredAndSortedMarkets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Search className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No markets found</h3>
            <p className="text-muted-foreground text-center">
              Try adjusting your search terms or filters to find markets.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className={cn(
          "grid gap-4",
          viewMode === "grid" ? "md:grid-cols-2 lg:grid-cols-3" : "grid-cols-1"
        )}>
          {filteredAndSortedMarkets.map((market) => (
            <Card key={market.id} className="hover:shadow-md transition-shadow cursor-pointer group">
              <CardHeader className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-lg leading-tight group-hover:text-primary transition-colors">
                    {market.title}
                  </CardTitle>
                  {getStatusBadge(market.status)}
                </div>
                
                {market.repository && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <GitBranch className="h-4 w-4" />
                    <code className="font-mono">{market.repository}</code>
                  </div>
                )}
                
                <CardDescription className="line-clamp-2">
                  {market.description}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Market Stats */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground">Total Liquidity</div>
                    <div className="font-semibold">{formatCurrency(market.totalLiquidity)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">24h Volume</div>
                    <div className="font-semibold">{formatCurrency(market.volume24h)}</div>
                  </div>
                </div>

                {/* Price Display */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                    <div className="text-xs text-green-700 font-medium">YES (Vulnerable)</div>
                    <div className="text-lg font-bold text-green-800">{formatPercentage(market.yesPrice)}</div>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                    <div className="text-xs text-red-700 font-medium">NO (Secure)</div>
                    <div className="text-lg font-bold text-red-800">{formatPercentage(market.noPrice)}</div>
                  </div>
                </div>

                {/* Tags */}
                {market.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {market.tags.slice(0, 3).map((tag) => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                    {market.tags.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{market.tags.length - 3} more
                      </Badge>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <Button asChild className="flex-1">
                    <a href={`/market/${market.id}`}>
                      {market.status === "resolved" ? "View Results" : "Trade Now"}
                    </a>
                  </Button>
                  <Button variant="outline" size="icon" asChild>
                    <a href={`#`} target="_blank" rel="noopener" title="View Contract">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
