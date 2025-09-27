"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { ChevronDown, Wallet } from "lucide-react"

type Chain = {
  id: string
  name: string
  symbol: string
}

const CHAINS: Chain[] = [
  { id: "eth", name: "Ethereum Mainnet", symbol: "ETH" },
  { id: "polygon", name: "Polygon", symbol: "MATIC" },
  { id: "hedera", name: "Hedera", symbol: "HBAR" },
]

export function WalletWidget({ compact = false }: { compact?: boolean }) {
  const [chain, setChain] = useState<Chain>(CHAINS[0])
  // Mock balance
  const balance = useMemo(() => {
    switch (chain.id) {
      case "polygon":
        return "842.19 MATIC"
      case "hedera":
        return "2,915.55 HBAR"
      default:
        return "1.234 ETH"
    }
  }, [chain])

  return (
    <div className="flex items-center gap-2">
      <Badge variant="secondary" className="rounded-md">
        <span className="sr-only">Current chain</span>
        {chain.name}
      </Badge>

      {!compact && <div className="text-sm text-muted-foreground">{balance}</div>}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="default" size={compact ? "sm" : "default"} className="rounded-md">
            <Wallet className="size-4 mr-2" />
            Switch
            <ChevronDown className="size-4 ml-2 opacity-80" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-56">
          {CHAINS.map((c) => (
            <DropdownMenuItem key={c.id} onClick={() => setChain(c)}>
              {c.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
