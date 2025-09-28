"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CalendarClock, GitBranch } from "lucide-react"
import { cn } from "@/lib/utils"
import { useRouter } from "next/navigation"

type Bet = {
  id: string
  vulnerability: string
  repository: string
  endsAt: string // ISO
  pool?: string
}

export function BetCard({
  bet,
  className,
  layout = "column",
}: {
  bet: Bet
  className?: string
  layout?: "row" | "column"
}) {
  const isRow = layout === "row"
  const router = useRouter()

  return (
    <Card className={cn("rounded-lg shadow-sm border", isRow ? "md:flex md:items-stretch" : "", className)}>
      <CardHeader className={cn("space-y-2", isRow ? "md:basis-1/2 md:max-w-[unset]" : "")}>
        <CardTitle className="text-balance">{bet.vulnerability}</CardTitle>
        <CardDescription className="flex items-center gap-2">
          <GitBranch className="size-4" />
          <span className="font-mono">{bet.repository}</span>
        </CardDescription>
      </CardHeader>

      <CardContent className={cn("space-y-3", isRow ? "md:flex-1 md:flex md:flex-col md:justify-center" : "")}>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CalendarClock className="size-4" />
          <span className="sr-only">Ends in</span>
          <Countdown endsAt={bet.endsAt} />
        </div>
        <div className="text-sm">
          <div className="text-muted-foreground">Pool</div>
          <div className="font-medium">{bet.pool || "Details coming soon"}</div>
        </div>
      </CardContent>

      <CardFooter
        className={cn(
          "flex justify-end",
          isRow
            ? "md:self-stretch md:flex md:items-center md:justify-center md:px-6 md:ml-auto md:border-l md:border-border"
            : "border-t",
        )}
      >
        <Button
          size="lg"
          type="button"
          className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md"
          aria-label={`Bet now on ${bet.vulnerability}`}
          onClick={() => {
            const url = `/market/${bet.id}?repo=${encodeURIComponent(
              bet.repository,
            )}&deadline=${encodeURIComponent(bet.endsAt)}`
            router.push(url)
          }}
        >
          Bet Now
        </Button>
      </CardFooter>
    </Card>
  )
}

function Countdown({ endsAt }: { endsAt: string }) {
  const end = useMemo(() => new Date(endsAt).getTime(), [endsAt])
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const diff = Math.max(0, end - now)
  const { d, h, m, s } = msToParts(diff)

  if (diff <= 0) {
    return <span className="text-destructive">Ended</span>
  }

  return (
    <span aria-live="polite" className="tabular-nums">
      Ends in {d}d {h}h {m}m {s}s
    </span>
  )
}

function msToParts(ms: number) {
  const sec = Math.floor(ms / 1000)
  const d = Math.floor(sec / 86400)
  const h = Math.floor((sec % 86400) / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60)
  return { d, h, m, s }
}
