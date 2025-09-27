"use client"

import { Card, CardContent } from "@/components/ui/card"

export function UserStats({
  liveContests,
  totalPoolUSDC,
}: {
  liveContests: number
  totalPoolUSDC: number
}) {
  const stats = [
    { label: "Live Contests", value: liveContests.toLocaleString() },
    {
      label: "Your Total Pool (USDC)",
      value: totalPoolUSDC.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    },
    {
      label: "Number of Bets",
      value: 15
    }
  ]

  return (
    <section aria-label="Your Stats" className="mb-6 md:mb-8">
      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <Card key={s.label} className="bg-card text-card-foreground">
            <CardContent className="py-4">
              <div className="text-sm leading-6 text-muted-foreground">{s.label}</div>
              <div className="mt-1 text-2xl font-semibold">{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Metrics shown are specific to your account.</p>
    </section>
  )
}
