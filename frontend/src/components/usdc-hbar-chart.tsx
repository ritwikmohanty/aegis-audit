"use client"

import { ResponsiveContainer, ScatterChart, CartesianGrid, XAxis, YAxis, Scatter } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"

// Example user-only pairs (USDC to corresponding HBAR values)
const userPairs = [
  { usdc: 50, hbar: 340 },
  { usdc: 100, hbar: 690 },

]

function impliedRate(pairs: { usdc: number; hbar: number }[]) {
  if (!pairs.length) return 0
  const sum = pairs.reduce((acc, p) => acc + p.hbar / p.usdc, 0)
  return sum / pairs.length
}

export function UsdcHbarChart() {
  const rate = impliedRate(userPairs) // HBAR per 1 USDC

  return (
    <Card className="bg-card text-card-foreground">
      <CardHeader>
        <CardTitle className="text-pretty">USDC vs HBAR</CardTitle>
        <CardDescription>User-specific value pairs for quick comparison</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          className="h-[320px]"
          config={{
            usdc: { label: "USDC", color: "hsl(var(--chart-1))" },
            hbar: { label: "HBAR", color: "hsl(var(--chart-2))" },
          }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 8, right: 6, bottom: 8, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" dataKey="usdc" name="USDC" tickLine={false} axisLine={false} tickMargin={8} />
              <YAxis type="number" dataKey="hbar" name="HBAR" tickLine={false} axisLine={false} tickMargin={8} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Scatter data={userPairs} fill="var(--color-usdc)" />
            </ScatterChart>
          </ResponsiveContainer>
        </ChartContainer>

        <div className="mt-4 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            <li>
              Implied rate: <span className="font-medium text-foreground">{rate.toFixed(2)} HBAR</span> per 1 USDC
            </li>
            <li>Pairs reflect your recent positions and pool entries</li>
            <li>
              Last updated: <span className="tabular-nums">just now</span>
            </li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}
